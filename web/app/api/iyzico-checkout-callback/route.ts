import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

async function sendExpoPush(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, any>,
) {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: pushToken, sound: "default", title, body, data }),
    });
  } catch {
    // sessizce devam
  }
}

function parseIncoming(bodyText: string): Record<string, string> {
  // iyzico çoğu zaman form-urlencoded gönderir
  try {
    const asJson = JSON.parse(bodyText);
    if (asJson && typeof asJson === "object") return asJson as any;
  } catch {
    // ignore
  }
  const params = new URLSearchParams(bodyText);
  const obj: Record<string, string> = {};
  params.forEach((v, k) => (obj[k] = v));
  return obj;
}

/**
 * POST /api/iyzico-checkout-callback
 *
 * iyzico checkout callback. token ile ödeme sonucunu retrieve edip DB günceller.
 */
export async function POST(req: NextRequest) {
  try {
    if (!iyzicoApiKey || !iyzicoSecretKey || !iyzicoUri) {
      return NextResponse.json(
        { error: "IYZICO env eksik" },
        { status: 500 },
      );
    }

    const raw = await req.text();
    const incoming = parseIncoming(raw);

    const token = incoming.token;
    const conversationId = incoming.conversationId || incoming.conversation_id;

    if (!token) {
      return NextResponse.json({ error: "token gerekli" }, { status: 400 });
    }

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id,order_id,iyzico_conversation_id")
      .eq("iyzico_checkout_token", token)
      .maybeSingle();

    if (!payment) {
      // token eşleşmediyse 200 dönmek daha güvenli (iyzico retry yapmasın)
      return NextResponse.json({ success: true, ignored: true });
    }

    const conv =
      conversationId || (payment as any).iyzico_conversation_id || `cb-${Date.now()}`;

    const retrieveBody = {
      locale: "tr",
      conversationId: conv,
      token,
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
    const ok = result?.status === "success" && normalizedPaymentStatus === "SUCCESS";
    const isFailed =
      normalizedPaymentStatus === "FAILURE" ||
      normalizedPaymentStatus === "FAILED" ||
      normalizedPaymentStatus === "FAIL";

    await supabaseAdmin
      .from("payments")
      .update({
        status: ok ? "paid" : isFailed ? "failed" : "awaiting_payment",
        iyzico_payment_id: result?.paymentId ?? null,
        iyzico_payment_transaction_id:
          result?.paymentTransactionId ??
          result?.paymentItems?.[0]?.paymentTransactionId ??
          null,
        iyzico_raw: result,
      })
      .eq("id", (payment as any).id);

    // Ödeme alındıysa kuryeye "başlayabilirsin" push gönder
    if (ok) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id,courier_id,pharmacies:pharmacy_id (name)")
        .eq("id", (payment as any).order_id)
        .maybeSingle();

      const courierId = (order as any)?.courier_id as string | null;
      if (courierId) {
        const { data: courier } = await supabaseAdmin
          .from("couriers")
          .select("user_id")
          .eq("id", courierId)
          .maybeSingle();

        if (courier?.user_id) {
          const { data: courierUser } = await supabaseAdmin
            .from("users")
            .select("push_token")
            .eq("id", courier.user_id)
            .maybeSingle();

          if (courierUser?.push_token) {
            const pharmacyName =
              ((order as any)?.pharmacies as any)?.name || "Eczane";
            await sendExpoPush(
              courierUser.push_token as string,
              "Ödeme Alındı",
              `${pharmacyName} siparişi için ödeme alındı. Teslimata başlayabilirsiniz.`,
              { orderId: (payment as any).order_id, type: "payment_paid" },
            );
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("iyzico-checkout-callback hatası:", err);
    // callback için 200 dönmek daha güvenli
    return NextResponse.json({ success: true });
  }
}

