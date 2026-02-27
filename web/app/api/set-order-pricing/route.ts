import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * POST /api/set-order-pricing
 *
 * Eczane sipariş için ilaç ücretini girer.
 * - payments tablosuna order bazlı ödeme kaydı oluşturur/günceller
 * - siparişi "approved" durumuna alır (kurye araması başlayabilsin)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, token, medicinePrice } = body as {
      orderId: string;
      token: string;
      medicinePrice: number | string;
    };

    if (!orderId || !token || medicinePrice === undefined || medicinePrice === null) {
      return NextResponse.json(
        { error: "orderId, token ve medicinePrice gerekli" },
        { status: 400 },
      );
    }

    const priceNum =
      typeof medicinePrice === "string"
        ? Number(medicinePrice.replace(",", "."))
        : Number(medicinePrice);

    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { error: "medicinePrice geçerli bir sayı olmalı (0'dan büyük)" },
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

    // Eczane bilgisi
    const { data: pharmacy, error: pharmacyErr } = await supabaseAdmin
      .from("pharmacies")
      .select("id,user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (pharmacyErr || !pharmacy) {
      return NextResponse.json(
        { error: "Eczane kaydı bulunamadı" },
        { status: 404 },
      );
    }

    // Sipariş bilgisi (eczane sahipliği doğrulaması)
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,pharmacy_id,status,courier_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    if ((order as any).pharmacy_id !== (pharmacy as any).id) {
      return NextResponse.json(
        { error: "Bu sipariş üzerinde yetkiniz yok" },
        { status: 403 },
      );
    }

    if ((order as any).status !== "pending") {
      return NextResponse.json(
        { error: "Sipariş fiyatlandırılabilir durumda değil", currentStatus: (order as any).status },
        { status: 400 },
      );
    }

    const deliveryFee = 120;
    const commissionRate = 0.12;
    const base = priceNum + deliveryFee;
    const commissionAmount = round2(base * commissionRate);
    const total = round2(base + commissionAmount);

    // payments kaydı oluştur/güncelle (order_id unique)
    const { error: payErr } = await supabaseAdmin.from("payments").upsert(
      {
        order_id: orderId,
        user_id: (order as any).user_id,
        pharmacy_id: (pharmacy as any).id,
        courier_id: (order as any).courier_id ?? null,
        currency: "TRY",
        medicine_price: round2(priceNum),
        delivery_fee: round2(deliveryFee),
        platform_commission_rate: commissionRate,
        platform_commission_amount: commissionAmount,
        total_price: total,
        status: "awaiting_payment",
      },
      { onConflict: "order_id" } as any,
    );

    if (payErr) {
      return NextResponse.json(
        { error: payErr.message || "Ödeme kaydı oluşturulamadı" },
        { status: 500 },
      );
    }

    // Siparişi approved'a al (kurye arama başlayabilsin)
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "approved" })
      .eq("id", orderId);

    if (updErr) {
      return NextResponse.json(
        { error: updErr.message || "Sipariş güncellenemedi" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      pricing: {
        medicinePrice: round2(priceNum),
        deliveryFee: round2(deliveryFee),
        platformCommissionRate: commissionRate,
        platformCommissionAmount: commissionAmount,
        total,
      },
    });
  } catch (err: any) {
    console.error("set-order-pricing hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}

