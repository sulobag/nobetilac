import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

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

/**
 * POST /api/send-payment-ready-push
 *
 * Kurye atandıktan sonra müşteriye "Ödemeniz hazır" bildirimi gönderir.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, token } = body as { orderId: string; token: string };

    if (!orderId || !token) {
      return NextResponse.json(
        { error: "orderId ve token gerekli" },
        { status: 400 },
      );
    }

    // İstek yapan kişiyi doğrula (eczane sahibi olmalı)
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(
        `id, user_id, pharmacy_id, status, courier_id,
         pharmacies:pharmacy_id ( id, name, user_id )`,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    const pharmacyData = order.pharmacies as any;
    if (!pharmacyData || pharmacyData.user_id !== user.id) {
      return NextResponse.json(
        { error: "Bu sipariş için bildirim gönderemezsiniz" },
        { status: 403 },
      );
    }

    // payment kaydı
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select(
        "id,status,total_price,medicine_price,delivery_fee,platform_commission_amount,currency",
      )
      .eq("order_id", orderId)
      .maybeSingle();

    if (!payment) {
      return NextResponse.json(
        { error: "Ödeme kaydı bulunamadı" },
        { status: 404 },
      );
    }

    // müşteri token
    const { data: customer } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .eq("id", (order as any).user_id)
      .maybeSingle();

    if (!customer?.push_token) {
      return NextResponse.json({
        success: true,
        pushed: false,
        reason: "Müşterinin push token'ı yok",
      });
    }

    const pharmacyName = pharmacyData?.name || "Eczane";
    const amountText =
      typeof (payment as any).total_price === "number"
        ? `${(payment as any).total_price.toFixed(2)} ${(payment as any).currency || "TRY"}`
        : `${(payment as any).total_price} ${(payment as any).currency || "TRY"}`;

    await sendExpoPush(
      customer.push_token as string,
      "Ödemeniz Hazır",
      `${pharmacyName} siparişinizi hazırladı. Toplam: ${amountText}. Ödeme yapınca kurye teslimata başlayacak.`,
      { orderId, paymentId: (payment as any).id, type: "payment_ready" },
    );

    return NextResponse.json({ success: true, pushed: true });
  } catch (err: any) {
    console.error("send-payment-ready-push hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}

