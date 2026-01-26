/**
 * KURYE OL - Helper Functions
 * 
 * Mevcut müşterilerin kurye olabilmesi için yardımcı fonksiyonlar
 */

import { supabase } from '@/lib/supabase';

export interface BecomeCourierParams {
  userId: string;
  vehicleType: 'motorcycle' | 'car' | 'bicycle' | 'scooter';
}

/**
 * Mevcut bir müşteriyi kurye yapar
 * 1. users.role'e 'courier' ekler
 * 2. couriers tablosuna kayıt ekler
 */
export async function becomeCourier({ 
  userId, 
  vehicleType 
}: BecomeCourierParams): Promise<{ error: Error | null }> {
  try {
    // 1. Kullanıcının mevcut rollerini al
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;
    if (!userData) throw new Error('Kullanıcı bulunamadı');

    // 2. Zaten kurye mi kontrol et
    if (userData.role.includes('courier')) {
      throw new Error('Zaten kurye kaydınız mevcut');
    }

    // 3. Role'e 'courier' ekle
    const newRoles = [...userData.role, 'courier'];
    const { error: updateError } = await supabase
      .from('users')
      // @ts-ignore - Supabase type inference issue
      .update({ role: newRoles })
      .eq('id', userId);

    if (updateError) throw updateError;

    // 4. Couriers tablosuna ekle
    const { error: courierError } = await supabase
      .from('couriers')
      // @ts-ignore - Supabase type inference issue
      .insert({
        user_id: userId,
        vehicle_type: vehicleType,
        is_available: false,
      });

    if (courierError) throw courierError;

    return { error: null };
  } catch (error) {
    console.error('Kurye olma hatası:', error);
    return { error: error as Error };
  }
}

/**
 * Kullanıcının kurye olup olmadığını kontrol eder
 */
export async function isCourier(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('couriers')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (normal, kurye değil)
      console.error('Kurye kontrolü hatası:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Kurye kontrolü hatası:', error);
    return false;
  }
}
