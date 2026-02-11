import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, status, token } = body as {
      orderId: string;
      status: string;
      token: string;
    };

    if (!orderId || !status || !token) {
      return NextResponse.json(
        { error: "orderId, status ve token gerekli" },
        { status: 400 },
      );
    }

    // İstek yapan kişiyi doğrula
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    // Sipariş bilgilerini al (service role ile tüm verilere erişim)
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(
        `id, user_id, pharmacy_id, prescription_no, pharmacies:pharmacy_id ( name, user_id )`,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı" },
        { status: 404 },
      );
    }

    // İsteği yapan kişinin eczanenin sahibi olduğunu doğrula
    const pharmacyData = order.pharmacies as any;
    if (!pharmacyData || pharmacyData.user_id !== user.id) {
      return NextResponse.json(
        { error: "Bu siparişi güncelleyemezsiniz" },
        { status: 403 },
      );
    }

    // Müşterinin push token'ını al
    const { data: customer } = await supabaseAdmin
      .from("users")
      .select("push_token, full_name")
      .eq("id", order.user_id)
      .maybeSingle();

    if (!customer?.push_token) {
      return NextResponse.json({
        success: true,
        pushed: false,
        reason: "Müşterinin push token'ı yok",
      });
    }

    // Expo Push API ile bildirim gönder
    const pharmacyName = pharmacyData?.name || "Eczane";
    const statusText =
      status === "approved" ? "onaylandı ✅" : "reddedildi ❌";
    const prescriptionNo = order.prescription_no
      ? ` (Reçete: ${order.prescription_no})`
      : "";

    const pushMessage = {
      to: customer.push_token,
      sound: "default",
      title: `Siparişiniz ${statusText}`,
      body: `${pharmacyName} siparişinizi ${statusText}.${prescriptionNo}`,
      data: { orderId: order.id, status },
    };

    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pushMessage),
    });

    const pushResult = await pushResponse.json();

    return NextResponse.json({
      success: true,
      pushed: true,
      pushResult,
    });
  } catch (err: any) {
    console.error("Push notification gönderme hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}
