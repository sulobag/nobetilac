import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// iyzico API bilgileri
const iyzicoApiKey = process.env.IYZICO_API_KEY!;
const iyzicoSecretKey = process.env.IYZICO_SECRET_KEY!;
const iyzicoUri = process.env.IYZICO_URI || "https://sandbox-api.iyzipay.com";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function generateRandomString(): string {
  // iyzipay-node benzeri: hem zaman hem random içerir
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

/**
 * iyzipay-node utils.generateAuthorizationHeaderV2 ile uyumlu
 * signature = HMACSHA256(secretKey, randomString + path + JSON.stringify(body)).hex
 * auth = "IYZWSv2 " + base64("apiKey:{apiKey}&randomKey:{random}&signature:{signature}")
 */
function generateAuthorizationHeaderV2(params: {
  apiKey: string;
  secretKey: string;
  randomKey: string;
  path: string;
  body: unknown;
}): string {
  const signature = crypto
    .createHmac("sha256", params.secretKey)
    .update(params.randomKey + params.path + JSON.stringify(params.body))
    .digest("hex");

  const authorizationParams = [
    `apiKey:${params.apiKey}`,
    `randomKey:${params.randomKey}`,
    `signature:${signature}`,
  ].join("&");

  return `IYZWSv2 ${Buffer.from(authorizationParams).toString("base64")}`;
}

/**
 * POST /api/create-submerchant
 * 
 * Eczane kaydı için iyzico'da submerchant oluşturur.
 * Bireysel (PERSONAL) tip alt üye işyeri oluşturur.
 */
export async function POST(req: NextRequest) {
  try {
    if (!iyzicoApiKey || !iyzicoSecretKey || !iyzicoUri) {
      return NextResponse.json(
        {
          error:
            "IYZICO_API_KEY, IYZICO_SECRET_KEY ve IYZICO_URI environment değişkenleri tanımlı olmalı",
        },
        { status: 500 },
      );
    }

    const body = await req.json();
    const {
      pharmacyId,
      token,
      name,
      email,
      phone,
      address,
      contactName,
      contactSurname,
      identityNumber,
      iban,
    } = body as {
      pharmacyId: string;
      token: string;
      name: string;
      email: string;
      phone: string;
      address: string;
      contactName: string;
      contactSurname: string;
      identityNumber: string;
      iban?: string;
    };

    // Validasyon
    if (
      !pharmacyId ||
      !token ||
      !name ||
      !email ||
      !phone ||
      !address ||
      !contactName ||
      !contactSurname ||
      !identityNumber
    ) {
      return NextResponse.json(
        {
          error:
            "pharmacyId, token, name, email, phone, address, contactName, contactSurname ve identityNumber gerekli",
        },
        { status: 400 }
      );
    }

    // Kullanıcıyı doğrula
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    // Eczane kaydını kontrol et
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("id, user_id, name, email, submerchant_key")
      .eq("id", pharmacyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (pharmacyError || !pharmacy) {
      return NextResponse.json(
        { error: "Eczane kaydı bulunamadı veya yetkiniz yok" },
        { status: 404 }
      );
    }

    // Eczane zaten submerchant key'e sahip mi kontrol et
    if ((pharmacy as any).submerchant_key) {
      return NextResponse.json(
        {
          error: "Bu eczane zaten submerchant olarak kayıtlı",
          submerchantKey: (pharmacy as any).submerchant_key,
        },
        { status: 400 }
      );
    }

    // iyzico'da submerchant oluştur (REST)
    const path = "/onboarding/submerchant";
    const conversationId = `pharmacy-${pharmacyId}-${Date.now()}`;
    const requestBody = {
      locale: "tr",
      conversationId,
      subMerchantType: "PERSONAL", // Bireysel alt üye işyeri
      subMerchantExternalId: pharmacyId,
      name,
      email,
      gsmNumber: phone,
      address,
      contactName,
      contactSurname,
      identityNumber,
      ...(iban ? { iban } : {}),
    };

    const randomKey = generateRandomString();
    const authorization = generateAuthorizationHeaderV2({
      apiKey: iyzicoApiKey,
      secretKey: iyzicoSecretKey,
      randomKey,
      path,
      body: requestBody,
    });

    const res = await fetch(`${iyzicoUri}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        "x-iyzi-rnd": randomKey,
        "x-iyzi-client-version": "nobetilac-web",
      },
      body: JSON.stringify(requestBody),
    });

    const result = (await res.json()) as any;

    if (!res.ok || result?.status === "failure") {
      console.error("iyzico submerchant oluşturma başarısız:", result);
      return NextResponse.json(
        {
          error: result?.errorMessage || "Submerchant oluşturulamadı",
          errorCode: result?.errorCode,
        },
        { status: 400 },
      );
    }

    if (!result?.subMerchantKey) {
      console.error("iyzico yanıtında subMerchantKey yok:", result);
      return NextResponse.json(
        { error: "Submerchant oluşturuldu ancak subMerchantKey alınamadı" },
        { status: 500 },
      );
    }

    // subMerchantKey'i veritabanına kaydet
    const { error: updateError } = await supabaseAdmin
      .from("pharmacies")
      .update({ submerchant_key: result.subMerchantKey })
      .eq("id", pharmacyId);

    if (updateError) {
      console.error("Submerchant key kaydetme hatası:", updateError);
      return NextResponse.json(
        {
          error: "Submerchant oluşturuldu ancak veritabanına kaydedilemedi",
          submerchantKey: result.subMerchantKey,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      submerchantKey: result.subMerchantKey,
      conversationId: result.conversationId || conversationId,
    });
  } catch (error: unknown) {
    console.error("Submerchant oluşturma genel hatası:", error);
    const msg =
      error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
