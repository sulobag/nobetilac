import { supabase } from "@/lib/supabase";

export interface BecomeCourierParams {
  userId: string;
  vehicleType: "motorcycle" | "car" | "bicycle" | "scooter";
}

export async function becomeCourier({
  userId,
  vehicleType,
}: BecomeCourierParams): Promise<{ error: Error | null }> {
  try {
    const { data: userData, error: fetchError } = (await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single()) as any;

    if (fetchError) throw fetchError;
    if (!userData) throw new Error("Kullanıcı bulunamadı");

    const currentRoles = userData.role as ("customer" | "courier" | "admin")[];
    if (currentRoles.includes("courier")) {
      throw new Error("Zaten kurye kaydınız mevcut");
    }

    const newRoles = [...currentRoles, "courier"] as (
      | "customer"
      | "courier"
      | "admin"
    )[];
    const { error: updateError } = (await (supabase as any)
      .from("users")
      .update({ role: newRoles })
      .eq("id", userId)) as any;

    if (updateError) throw updateError;

    const courierData: any = {
      user_id: userId,
      vehicle_type: vehicleType,
      is_available: false,
    };
    const { error: courierError } = (await supabase
      .from("couriers")
      .insert(courierData)) as any;

    if (courierError) throw courierError;

    return { error: null };
  } catch (error) {
    console.error("Kurye olma hatası:", error);
    return { error: error as Error };
  }
}

export async function isCourier(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("couriers")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Kurye kontrolü hatası:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Kurye kontrolü hatası:", error);
    return false;
  }
}
