import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';
import { router } from 'expo-router';

type UserProfile = Database['public']['Tables']['users']['Row'];

interface AuthContextType {
  session: Session | null;
  user: SupabaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  hasAddress: boolean | null;
  signUp: (
    email: string,
    password: string,
    phone: string,
    fullName: string,
    role: 'customer' | 'courier',
    vehicleType?: 'motorcycle' | 'car' | 'bicycle' | 'scooter'
  ) => Promise<{ error: Error | null; needsVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  verifyOTP: (email: string, token: string) => Promise<{ error: Error | null }>;
  resendOTP: (email: string) => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  checkUserAddresses: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAddress, setHasAddress] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data as UserProfile);

      if (data && (data as UserProfile).role.includes('customer')) {
        await checkUserAddresses(userId);
      }
    } catch (error: any) {
      console.error('Profil yüklenirken hata:', error);
      
      if (error?.code === 'PGRST116' || error?.details?.includes('0 rows')) {
        console.log('❌ Profil bulunamadı, kullanıcı çıkış yapılıyor...');
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        router.replace('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkUserAddresses = async (userId?: string) => {
    try {
      const uid = userId || user?.id;
      if (!uid) return;

      const { data, error } = await supabase
        .from('addresses')
        .select('id')
        .eq('user_id', uid)
        .limit(1);

      if (error) throw error;
      setHasAddress((data && data.length > 0) || false);
    } catch (error) {
      console.error('Adres kontrolü hatası:', error);
      setHasAddress(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    phone: string,
    fullName: string,
    role: 'customer' | 'courier',
    vehicleType?: 'motorcycle' | 'car' | 'bicycle' | 'scooter'
  ) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Kullanıcı oluşturulamadı');

      const userRoles: ('customer' | 'courier')[] = 
        role === 'courier' ? ['customer', 'courier'] : ['customer'];
      
      const userData: Database['public']['Tables']['users']['Insert'] = {
        id: authData.user.id,
        email,
        phone,
        full_name: fullName,
        role: userRoles,
      };
      
      const { error: profileError } = await supabase
        .from('users')
        // @ts-ignore
        .insert(userData);

      if (profileError) throw profileError;

      if (role === 'courier') {
        if (!vehicleType) {
          throw new Error('Kurye için araç tipi gereklidir');
        }

        const courierData = {
          user_id: authData.user.id,
          vehicle_type: vehicleType,
          is_available: false,
        };
        
        const { error: courierError } = await supabase
          .from('couriers')
          // @ts-ignore
          .insert(courierData);

        if (courierError) throw courierError;
      }

      const needsVerification = !authData.session;

      return { error: null, needsVerification };
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      
      let errorMessage = error.message || 'Bir hata oluştu';
      
      if (error.code === '23505') {
        if (error.message.includes('users_email_key')) {
          errorMessage = 'Bu email adresi zaten kullanılıyor';
        } else if (error.message.includes('users_phone_key')) {
          errorMessage = 'Bu telefon numarası zaten kullanılıyor';
        }
      }
      
      if (error.message?.includes('User already registered')) {
        errorMessage = 'Bu email adresi zaten kayıtlı';
      }
      
      return { error: new Error(errorMessage) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Giriş hatası:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
    } catch (error) {
      console.error('Çıkış hatası:', error);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!user) throw new Error('Kullanıcı oturumu bulunamadı');

      // @ts-ignore
      const updateData: Database['public']['Tables']['users']['Update'] = updates;
      
      const { error } = await supabase
        .from('users')
        // @ts-ignore
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, ...updates } : null));

      return { error: null };
    } catch (error) {
      console.error('Profil güncelleme hatası:', error);
      return { error: error as Error };
    }
  };

  const verifyOTP = async (email: string, token: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) throw error;
      
      if (data?.session) {
        console.log('✅ Email doğrulandı ve otomatik giriş yapıldı');
        return { error: null, session: data.session };
      }
      
      return { error: null };
    } catch (error) {
      console.error('OTP doğrulama hatası:', error);
      return { error: error as Error };
    }
  };

  const resendOTP = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('OTP tekrar gönderme hatası:', error);
      return { error: error as Error };
    }
  };

  const deleteAccount = async () => {
    try {
      if (!user) throw new Error('Kullanıcı oturumu bulunamadı');

      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (deleteError) throw deleteError;

      setSession(null);
      setUser(null);
      setProfile(null);

      return { error: null };
    } catch (error) {
      console.error('Hesap silme hatası:', error);
      return { error: error as Error };
    }
  };

  const value = {
    session,
    user,
    profile,
    loading,
    hasAddress,
    signUp,
    signIn,
    signOut,
    updateProfile,
    verifyOTP,
    resendOTP,
    deleteAccount,
    checkUserAddresses,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır');
  }
  return context;
}
