import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

/**
 * GET /api/courier-orders
 *
 * Kurye paneli için: aktif sipariş + bugünün teslim sayısı + kurye kaydı
 * Service role kullanarak RLS'yi bypass eder.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "token gerekli" }, { status: 401 });
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

    // Kurye kaydını al
    const { data: courier, error: courierErr } = await supabaseAdmin
      .from("couriers")
      .select("id, user_id, is_available, vehicle_type, latitude, longitude")
      .eq("user_id", user.id)
      .maybeSingle();

    if (courierErr || !courier) {
      return NextResponse.json(
        { error: "Kurye kaydı bulunamadı" },
        { status: 404 },
      );
    }

    // Aktif sipariş (courier_assigned veya in_transit)
    const { data: activeOrder } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id, status, prescription_no, note, created_at, user_id,
        payments:payments!payments_order_id_fkey ( status ),
        pharmacies:pharmacy_id ( name, city, district, phone, street, building_no ),
        addresses:address_id ( formatted_address, city, district, neighborhood, street, building_no )
      `,
      )
      .eq("courier_id", courier.id)
      .in("status", ["courier_assigned", "in_transit"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Aktif sipariş varsa müşteri bilgilerini al
    let customerInfo: { full_name: string | null; phone: string | null } | null =
      null;
    if (activeOrder?.user_id) {
      const { data: cust } = await supabaseAdmin
        .from("users")
        .select("full_name, phone")
        .eq("id", activeOrder.user_id)
        .maybeSingle();
      customerInfo = cust
        ? {
            full_name: (cust as any).full_name ?? null,
            phone: (cust as any).phone ?? null,
          }
        : null;
    }

    // Bugünün teslim sayısı
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayDelivered } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("courier_id", courier.id)
      .eq("status", "delivered")
      .gte("created_at", todayStart.toISOString());

    return NextResponse.json({
      courier: {
        id: courier.id,
        user_id: courier.user_id,
        is_available: courier.is_available,
        vehicle_type: courier.vehicle_type,
      },
      activeOrder: activeOrder
        ? {
            ...activeOrder,
            customer: customerInfo,
            payment_status: Array.isArray((activeOrder as any).payments)
              ? (activeOrder as any).payments?.[0]?.status ?? null
              : (activeOrder as any).payments?.status ?? null,
          }
        : null,
      todayDelivered: todayDelivered || 0,
    });
  } catch (err: any) {
    console.error("Kurye siparişleri hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}
