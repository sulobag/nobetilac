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
 * POST /api/cancel-order
 *
 * Müşteri, fiyatı beğenmezse (ödeme yapılmadan) siparişi iptal edebilir.
 * Koşullar:
 * - order.user_id === auth user
 * - order.status in ('approved','courier_assigned')
 * - payments.status === 'awaiting_payment'
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
        "id,user_id,pharmacy_id,status,courier_id, pharmacies:pharmacy_id (name)",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    if ((order as any).user_id !== user.id) {
      return NextResponse.json(
        { error: "Bu siparişi iptal edemezsiniz" },
        { status: 403 },
      );
    }

    const currentStatus = (order as any).status as string;
    if (!["approved", "courier_assigned"].includes(currentStatus)) {
      return NextResponse.json(
        { error: "Sipariş iptal edilebilir durumda değil", currentStatus },
        { status: 400 },
      );
    }

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select("id,status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (payErr || !payment) {
      return NextResponse.json(
        { error: "Ödeme kaydı bulunamadı" },
        { status: 404 },
      );
    }

    if ((payment as any).status !== "awaiting_payment") {
      return NextResponse.json(
        {
          error: "Ödeme durumu iptal için uygun değil",
          paymentStatus: (payment as any).status,
        },
        { status: 400 },
      );
    }

    // Ödemeyi iptal et
    const { error: updPayErr } = await supabaseAdmin
      .from("payments")
      .update({ status: "cancelled" })
      .eq("id", (payment as any).id);

    if (updPayErr) {
      return NextResponse.json(
        { error: updPayErr.message || "Ödeme iptal edilemedi" },
        { status: 500 },
      );
    }

    // Siparişi iptal et (courier_id temizle)
    const { error: updOrderErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled", courier_id: null })
      .eq("id", orderId);

    if (updOrderErr) {
      return NextResponse.json(
        { error: updOrderErr.message || "Sipariş iptal edilemedi" },
        { status: 500 },
      );
    }

    // Kurye atanmışsa kuryeye haber ver
    const courierId = (order as any).courier_id as string | null;
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
          await sendExpoPush(
            courierUser.push_token as string,
            "Sipariş İptal Edildi",
            "Müşteri ödemeyi onaylamadığı için sipariş iptal edildi.",
            { orderId, type: "order_cancelled" },
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("cancel-order hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}

