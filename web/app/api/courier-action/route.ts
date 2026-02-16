import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    /* sessizce devam */
  }
}

/** 6 haneli rastgele teslimat kodu üret */
function generateDeliveryCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Kurye aksiyonları: accept, reject, deliver
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action, token, deliveryCode } = body as {
      orderId: string;
      action: "accept" | "reject" | "deliver";
      token: string;
      deliveryCode?: string;
    };

    if (!orderId || !action || !token) {
      return NextResponse.json(
        { error: "orderId, action ve token gerekli" },
        { status: 400 },
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

    // Kuryenin kaydını bul
    const { data: courier } = await supabaseAdmin
      .from("couriers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!courier) {
      return NextResponse.json(
        { error: "Kurye kaydı bulunamadı" },
        { status: 403 },
      );
    }

    // Sipariş bilgilerini al
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(
        `id, user_id, pharmacy_id, courier_id, status, rejected_courier_ids, prescription_no, delivery_code,
         pharmacies:pharmacy_id ( name )`,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı" },
        { status: 404 },
      );
    }

    // Kuryenin bu siparişe atanmış olduğunu doğrula
    if (order.courier_id !== courier.id) {
      return NextResponse.json(
        { error: "Bu sipariş size atanmamış" },
        { status: 403 },
      );
    }

    const pharmacyName = ((order.pharmacies as any)?.name as string) || "Eczane";

    // Müşteri push token
    const { data: customer } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .eq("id", order.user_id)
      .maybeSingle();

    const customerPushToken = (customer?.push_token as string) || null;

    // --- KABUL ---
    if (action === "accept") {
      if (order.status !== "courier_assigned") {
        return NextResponse.json(
          { error: "Sipariş kabul edilebilir durumda değil" },
          { status: 400 },
        );
      }

      // 6 haneli teslimat doğrulama kodu üret
      const code = generateDeliveryCode();

      await supabaseAdmin
        .from("orders")
        .update({ status: "in_transit", delivery_code: code })
        .eq("id", orderId);

      if (customerPushToken) {
        await sendExpoPush(
          customerPushToken,
          "Kurye Yolda! 🚀",
          `Siparişiniz kurye tarafından kabul edildi. Teslimat kodunuz: ${code}`,
          { orderId: order.id, status: "in_transit", deliveryCode: code },
        );
      }

      return NextResponse.json({ success: true, newStatus: "in_transit" });
    }

    // --- RED ---
    if (action === "reject") {
      if (order.status !== "courier_assigned") {
        return NextResponse.json(
          { error: "Sipariş reddedilebilir durumda değil" },
          { status: 400 },
        );
      }

      const rejectedIds: string[] =
        (order.rejected_courier_ids as string[]) || [];
      const updatedRejectedIds = [...rejectedIds, courier.id];

      await supabaseAdmin
        .from("orders")
        .update({
          courier_id: null,
          status: "approved",
          rejected_courier_ids: updatedRejectedIds,
        })
        .eq("id", orderId);

      const assignUrl = new URL("/api/assign-courier", req.nextUrl.origin);
      await fetch(assignUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, token }),
      });

      return NextResponse.json({ success: true, newStatus: "approved" });
    }

    // --- TESLİM ---
    if (action === "deliver") {
      if (order.status !== "in_transit") {
        return NextResponse.json(
          { error: "Sipariş teslim edilebilir durumda değil" },
          { status: 400 },
        );
      }

      // Teslimat kodu doğrulama
      if (!deliveryCode) {
        return NextResponse.json(
          { error: "Teslimat kodu gerekli" },
          { status: 400 },
        );
      }

      if (order.delivery_code !== deliveryCode) {
        return NextResponse.json(
          { error: "Teslimat kodu hatalı" },
          { status: 400 },
        );
      }

      await supabaseAdmin
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", orderId);

      if (customerPushToken) {
        await sendExpoPush(
          customerPushToken,
          "Sipariş Teslim Edildi! ✅",
          `${pharmacyName} eczanesinden gelen siparişiniz teslim edildi.`,
          { orderId: order.id, status: "delivered" },
        );
      }

      return NextResponse.json({ success: true, newStatus: "delivered" });
    }

    return NextResponse.json(
      { error: "Geçersiz aksiyon" },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("Kurye aksiyon hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}
