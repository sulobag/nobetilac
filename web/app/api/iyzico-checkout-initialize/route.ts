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
const iyzicoCallbackUrl =
  process.env.IYZICO_CALLBACK_URL ||
  `${process.env.NEXT_PUBLIC_SITE_URL}/api/iyzico-checkout-callback`;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const INIT_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";

function formatPrice(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return (Math.round(v * 100) / 100).toFixed(2);
}

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

function splitName(fullName: string | null | undefined): {
  name: string;
  surname: string;
} {
  const raw = (fullName || "").trim();
  if (!raw) return { name: "Müşteri", surname: " " };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { name: parts[0], surname: " " };
  return { name: parts[0], surname: parts.slice(1).join(" ") };
}

function normalizeGsmNumber(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "+905555555555";
  if (s.startsWith("+")) return s;
  const digits = s.replace(/\D/g, "");
  // 05xxxxxxxxx -> +905xxxxxxxxx
  if (digits.length === 11 && digits.startsWith("0")) return `+9${digits}`;
  // 5xxxxxxxxx -> +905xxxxxxxxx
  if (digits.length === 10 && digits.startsWith("5")) return `+90${digits}`;
  // 90xxxxxxxxxx -> +90xxxxxxxxxx
  if (digits.length === 12 && digits.startsWith("90")) return `+${digits}`;
  return `+${digits}` || "+905555555555";
}

/**
 * POST /api/iyzico-checkout-initialize
 *
 * paymentId için iyzico checkout form initialize eder.
 * Dönüş: checkoutFormContent (HTML) + token
 */
export async function POST(req: NextRequest) {
  try {
    if (!iyzicoApiKey || !iyzicoSecretKey || !iyzicoUri) {
      return NextResponse.json(
        { error: "IYZICO_API_KEY/IYZICO_SECRET_KEY/IYZICO_URI eksik" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const { paymentId, token } = body as { paymentId: string; token: string };

    if (!paymentId || !token) {
      return NextResponse.json(
        { error: "paymentId ve token gerekli" },
        { status: 400 },
      );
    }

    // kullanıcı doğrula
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select(
        "id,order_id,user_id,pharmacy_id,medicine_price,total_price,currency,status,iyzico_checkout_token,iyzico_conversation_id",
      )
      .eq("id", paymentId)
      .maybeSingle();

    if (payErr || !payment) {
      return NextResponse.json({ error: "Ödeme bulunamadı" }, { status: 404 });
    }

    if ((payment as any).user_id !== user.id) {
      return NextResponse.json(
        { error: "Bu ödeme için yetkiniz yok" },
        { status: 403 },
      );
    }

    // paid/cancelled dışındaki durumlarda (örn: failed) tekrar initialize edilebilsin.
    if ((payment as any).status === "paid") {
      return NextResponse.json(
        { error: "Bu ödeme zaten alınmış", paymentStatus: (payment as any).status },
        { status: 400 },
      );
    }
    if ((payment as any).status === "cancelled") {
      return NextResponse.json(
        { error: "Bu ödeme iptal edilmiş", paymentStatus: (payment as any).status },
        { status: 400 },
      );
    }

    const orderId = (payment as any).order_id as string;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        `id, prescription_no, note, status,
         addresses:address_id ( formatted_address, city, district, neighborhood, street, building_no )`,
      )
      .eq("id", orderId)
      .maybeSingle();

    const { data: customerRow } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, phone")
      .eq("id", user.id)
      .maybeSingle();

    const { data: pharmacy } = await supabaseAdmin
      .from("pharmacies")
      .select("id, name, city, district, neighborhood, street, building_no, submerchant_key")
      .eq("id", (payment as any).pharmacy_id)
      .maybeSingle();

    if (!pharmacy?.submerchant_key) {
      return NextResponse.json(
        { error: "Eczanenin submerchant_key bilgisi eksik" },
        { status: 400 },
      );
    }

    const addr = (order as any)?.addresses || null;
    const addressText =
      addr?.formatted_address ||
      `${addr?.neighborhood ?? ""} ${addr?.street ?? ""} No:${addr?.building_no ?? ""} ${addr?.district ?? ""}/${addr?.city ?? ""}`.trim();

    const customerName = splitName((customerRow as any)?.full_name);
    const buyerEmail = (customerRow as any)?.email || user.email || "test@test.com";
    const buyerPhone = normalizeGsmNumber((customerRow as any)?.phone || "05000000000");

    // iyzico buyer.identityNumber zorunlu (bizde müşteri tarafında yok, sandbox fallback)
    const buyerIdentityNumber = "11111111111";

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const conversationId = `pay-${paymentId}-${Date.now()}`;
    const currency = (payment as any).currency || "TRY";
    const totalPrice = Number((payment as any).total_price);
    const medicinePrice = Number((payment as any).medicine_price);

    const requestBody = {
      locale: "tr",
      conversationId,
      price: formatPrice(totalPrice),
      paidPrice: formatPrice(totalPrice),
      currency,
      basketId: orderId,
      paymentGroup: "PRODUCT",
      callbackUrl: iyzicoCallbackUrl,
      paymentSource: "MOBILE",
      buyer: {
        id: user.id,
        name: customerName.name,
        surname: customerName.surname,
        identityNumber: buyerIdentityNumber,
        email: buyerEmail,
        gsmNumber: buyerPhone,
        registrationAddress: addressText || "Adres yok",
        city: addr?.city || "Istanbul",
        country: "Turkey",
        zipCode: "00000",
        ip,
        registrationDate: new Date().toISOString().slice(0, 19).replace("T", " "),
        lastLoginDate: new Date().toISOString().slice(0, 19).replace("T", " "),
      },
      shippingAddress: {
        contactName: `${customerName.name} ${customerName.surname}`.trim(),
        city: addr?.city || "Istanbul",
        country: "Turkey",
        address: addressText || "Adres yok",
        zipCode: "00000",
      },
      billingAddress: {
        contactName: `${customerName.name} ${customerName.surname}`.trim(),
        city: addr?.city || "Istanbul",
        country: "Turkey",
        address: addressText || "Adres yok",
        zipCode: "00000",
      },
      basketItems: [
        {
          id: orderId,
          name: "Reçete Siparişi",
          category1: "Pharmacy",
          category2: "Medicine",
          itemType: "PHYSICAL",
          price: formatPrice(totalPrice),
          subMerchantKey: pharmacy.submerchant_key,
          subMerchantPrice: formatPrice(medicinePrice),
        },
      ],
    };

    const rnd = randomKey();
    const authorization = generateAuthorizationHeaderV2({
      apiKey: iyzicoApiKey,
      secretKey: iyzicoSecretKey,
      randomKey: rnd,
      path: INIT_PATH,
      body: requestBody,
    });

    const iyzRes = await fetch(`${iyzicoUri}${INIT_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        "x-iyzi-rnd": rnd,
        "x-iyzi-client-version": "nobetilac-web",
      },
      body: JSON.stringify(requestBody),
    });

    const iyzResult = (await iyzRes.json()) as any;

    if (!iyzRes.ok || iyzResult?.status === "failure") {
      return NextResponse.json(
        {
          error: iyzResult?.errorMessage || "Checkout initialize başarısız",
          errorCode: iyzResult?.errorCode,
          details: iyzResult,
        },
        { status: 400 },
      );
    }

    if (!iyzResult?.token || !iyzResult?.checkoutFormContent) {
      return NextResponse.json(
        { error: "iyzico yanıtı eksik (token/checkoutFormContent yok)" },
        { status: 500 },
      );
    }

    // iOS ATS bazı http kaynakları bloklayıp "beyaz ekran" yapabiliyor.
    // checkoutFormContent içindeki iyzico statik script'leri varsa https'e normalize edelim.
    let checkoutHtml = String(iyzResult.checkoutFormContent);
    checkoutHtml = checkoutHtml.replace(
      /http:\/\/(sandbox-static\.iyzipay\.com|static\.iyzipay\.com|sandbox-api\.iyzipay\.com|api\.iyzipay\.com)/gi,
      "https://$1",
    );

    await supabaseAdmin
      .from("payments")
      .update({
        status: "awaiting_payment",
        iyzico_conversation_id: conversationId,
        iyzico_basket_id: orderId,
        iyzico_checkout_token: iyzResult.token,
        iyzico_raw: iyzResult,
      })
      .eq("id", paymentId);

    return NextResponse.json({
      success: true,
      token: iyzResult.token,
      checkoutFormContent: checkoutHtml,
    });
  } catch (err: any) {
    console.error("iyzico-checkout-initialize hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}

