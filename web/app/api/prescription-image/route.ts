import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@mobile-types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  const token = req.nextUrl.searchParams.get("token");

  if (!orderId) {
    return NextResponse.json({ error: "orderId gerekli" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "token gerekli" }, { status: 401 });
  }

  const supabaseUser = createClient<Database>(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { data: order, error } = await supabaseUser
    .from("orders")
    .select(
      `
        id,
        user_id,
        pharmacy_id,
        prescription_image_path,
        pharmacies:pharmacy_id ( user_id )
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order || !order.prescription_image_path) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const isCustomer = order.user_id === user.id;
  const isPharmacy =
    order.pharmacies && (order.pharmacies as any).user_id === user.id;

  if (!isCustomer && !isPharmacy) {
    return NextResponse.json({ error: "Erişim yok" }, { status: 403 });
  }

  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from("prescriptions")
    .createSignedUrl(order.prescription_image_path, 60);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: "URL üretilemedi" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}

