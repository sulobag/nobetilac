import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function GET(req: NextRequest) {
  try {
    const paymentId = req.nextUrl.searchParams.get("paymentId");
    const token = req.nextUrl.searchParams.get("token");

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
      .select("id,user_id,status,order_id,total_price,currency")
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment) return NextResponse.json({ error: "Ödeme yok" }, { status: 404 });
    if ((payment as any).user_id !== user.id) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }

    return NextResponse.json({
      id: (payment as any).id,
      status: (payment as any).status,
      orderId: (payment as any).order_id,
      totalPrice: (payment as any).total_price,
      currency: (payment as any).currency,
    });
  } catch (err: any) {
    console.error("payment-status hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500 },
    );
  }
}

