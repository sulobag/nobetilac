import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

/**
 * Haversine formülü ile iki koordinat arası mesafe (km)
 */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Expo Push API ile bildirim gönder
 */
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
      body: JSON.stringify({
        to: pushToken,
        sound: "default",
        title,
        body,
        data,
      }),
    });
  } catch {
    // Push gönderilemezse sessizce devam et
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, token, giveUp } = body as {
      orderId: string;
      token: string;
      giveUp?: boolean; // true ise artık denemeyi bırak, iptal et
    };

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

    // Sipariş + eczane bilgilerini al
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(
        `id, user_id, pharmacy_id, status, rejected_courier_ids,
         pharmacies:pharmacy_id ( id, name, user_id, latitude, longitude )`,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı" },
        { status: 404 },
      );
    }

    // Sipariş approved durumunda olmalı
    if (order.status !== "approved") {
      return NextResponse.json(
        {
          error: "Sipariş kurye ataması için uygun değil",
          currentStatus: order.status,
        },
        { status: 400 },
      );
    }

    // giveUp=true ise: Tüm denemeler tükendi, müşteriye bildir
    if (giveUp) {
      const { data: customer } = await supabaseAdmin
        .from("users")
        .select("push_token")
        .eq("id", order.user_id)
        .maybeSingle();

      if (customer?.push_token) {
        await sendExpoPush(
          customer.push_token as string,
          "Kurye Bulunamadı",
          "Siparişiniz için uygun kurye bulunamadı. Lütfen daha sonra tekrar deneyin.",
          { orderId: order.id, status: "no_courier" },
        );
      }

      await supabaseAdmin
        .from("orders")
        .update({ status: "rejected", courier_id: null })
        .eq("id", orderId);

      return NextResponse.json({
        success: true,
        assigned: false,
        gaveUp: true,
        reason: "Tüm denemeler tükendi, sipariş iptal edildi",
      });
    }

    const pharmacyData = order.pharmacies as any;
    const pharmacyLat = pharmacyData?.latitude;
    const pharmacyLng = pharmacyData?.longitude;

    if (!pharmacyLat || !pharmacyLng) {
      return NextResponse.json({
        success: false,
        assigned: false,
        reason: "Eczane konum bilgisi eksik",
      });
    }

    // Çevrimiçi kuryeler
    const { data: couriers, error: courierErr } = await supabaseAdmin
      .from("couriers")
      .select("id, user_id, latitude, longitude")
      .eq("is_available", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (courierErr) {
      return NextResponse.json(
        { error: "Kuryeler alınırken hata oluştu" },
        { status: 500 },
      );
    }

    // Reddedilen kuryeleri filtrele
    const rejectedIds: string[] =
      (order.rejected_courier_ids as string[]) || [];
    const availableCouriers = (couriers || []).filter(
      (c: any) => !rejectedIds.includes(c.id),
    );

    if (availableCouriers.length === 0) {
      // Kurye bulunamadı ama siparişi iptal ETME
      // Sipariş "approved" olarak kalır, web paneli tekrar deneyecek
      return NextResponse.json({
        success: true,
        assigned: false,
        shouldRetry: true,
        reason: "Şu an uygun kurye yok, yeniden denenecek",
      });
    }

    // En yakın kuryeyi bul
    let nearestCourier: any = null;
    let minDistance = Infinity;

    for (const courier of availableCouriers) {
      const dist = haversineKm(
        pharmacyLat,
        pharmacyLng,
        courier.latitude as number,
        courier.longitude as number,
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestCourier = courier;
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        courier_id: nearestCourier.id,
        status: "courier_assigned",
      })
      .eq("id", orderId);

    if (updateErr) {
      return NextResponse.json(
        { error: "Sipariş güncellenirken hata oluştu" },
        { status: 500 },
      );
    }

    // Kuryeye push notification gönder
    const { data: courierUser } = await supabaseAdmin
      .from("users")
      .select("push_token, full_name")
      .eq("id", nearestCourier.user_id)
      .maybeSingle();

    if (courierUser?.push_token) {
      const pharmacyName = pharmacyData?.name || "Eczane";
      await sendExpoPush(
        courierUser.push_token as string,
        "Yeni Sipariş!",
        `${pharmacyName} eczanesinden yeni bir teslimat talebi geldi. (${minDistance.toFixed(1)} km)`,
        { orderId: order.id, type: "courier_assignment" },
      );
    }

    // Kuryenin sipariş kanalına bildirim yayınla (Realtime broadcast)
    await supabaseAdmin.channel(`courier_notify_${nearestCourier.id}`).send({
      type: "broadcast",
      event: "new_order",
      payload: { orderId: order.id },
    });

    return NextResponse.json({
      success: true,
      assigned: true,
      courierId: nearestCourier.id,
      distance: minDistance.toFixed(1),
    });
  } catch (err: any) {
    console.error("Kurye atama hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}
