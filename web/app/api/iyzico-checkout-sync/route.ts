import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const iyzicoApiKey = process.env.IYZICO_API_KEY!;
const iyzicoSecretKey = process.env.IYZICO_SECRET_KEY!;
const iyzicoUri = process.env.IYZICO_URI || "https://sandbox-api.iyzipay.com";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const RETRIEVE_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";

function randomKey(): string {
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

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
 * POST /api/iyzico-checkout-sync
 *
 * Client tetikler: iyzico checkout token ile retrieve yapıp payment status'u günceller.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, token } = body as { paymentId: string; token: string };

    if (!paymentId || !token) {
      return NextResponse.json(
        { error: "paymentId ve token gerekli" },
        { status: 400 },
      );
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id,user_id,iyzico_checkout_token,iyzico_conversation_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment) return NextResponse.json({ error: "Ödeme yok" }, { status: 404 });
    if ((payment as any).user_id !== user.id) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    if (!(payment as any).iyzico_checkout_token) {
      return NextResponse.json(
        { error: "Checkout token yok (initialize edilmemiş)" },
        { status: 400 },
      );
    }

    const retrieveBody = {
      locale: "tr",
      conversationId:
        (payment as any).iyzico_conversation_id || `sync-${Date.now()}`,
      token: (payment as any).iyzico_checkout_token,
    };

    const rnd = randomKey();
    const authorization = generateAuthorizationHeaderV2({
      apiKey: iyzicoApiKey,
      secretKey: iyzicoSecretKey,
      randomKey: rnd,
      path: RETRIEVE_PATH,
      body: retrieveBody,
    });

    const r = await fetch(`${iyzicoUri}${RETRIEVE_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        "x-iyzi-rnd": rnd,
        "x-iyzi-client-version": "nobetilac-web",
      },
      body: JSON.stringify(retrieveBody),
    });

    const result = (await r.json()) as any;

    const paymentStatus = result?.paymentStatus;
    const normalizedPaymentStatus =
      typeof paymentStatus === "string" ? paymentStatus.toUpperCase() : null;

    // Kritik: ödeme tamamlanmadan "failed" yazmayalım.
    // Retrieve bazen ödeme henüz yapılmadıysa failure dönebiliyor.
    const isPaid = result?.status === "success" && normalizedPaymentStatus === "SUCCESS";
    const isFailed =
      normalizedPaymentStatus === "FAILURE" ||
      normalizedPaymentStatus === "FAILED" ||
      normalizedPaymentStatus === "FAIL";

    const updatePayload: Record<string, any> = {
      iyzico_payment_id: result?.paymentId ?? null,
      iyzico_payment_transaction_id:
        result?.paymentTransactionId ??
        result?.paymentItems?.[0]?.paymentTransactionId ??
        null,
      iyzico_raw: result,
    };
    if (isPaid) updatePayload.status = "paid";
    else if (isFailed) updatePayload.status = "failed";

    await supabaseAdmin.from("payments").update(updatePayload).eq("id", paymentId);

    return NextResponse.json({
      success: true,
      paid: isPaid,
      status: isPaid ? "paid" : result?.status,
      paymentStatus,
    });
  } catch (err: any) {
    console.error("iyzico-checkout-sync hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}

