"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import OrdersView from "./orders/OrdersView";

type ViewState = "login" | "orders";

export default function HomePage() {
  const [view, setView] = useState<ViewState>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        setCheckingSession(false);
        return;
      }

      const { data: pharmacy, error: pharmacyError } = await supabase
        .from("pharmacies")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (pharmacyError) {
        setError("Eczane bilgisi alınırken bir hata oluştu.");
      } else if (pharmacy) {
        setView("orders");
      }

      setCheckingSession(false);
    };

    void checkSession();
  }, []);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Email ve şifre zorunludur.");
      return;
    }

    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    if (!data.user) {
      setError("Giriş başarılı ancak kullanıcı bilgisi alınamadı.");
      return;
    }

    const { data: pharmacy, error: pharmacyError } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (pharmacyError) {
      setError("Eczane bilgisi alınırken bir hata oluştu.");
      return;
    }

    if (!pharmacy) {
      setError(
        "Bu panel yalnızca eczane hesabı olan kullanıcılar içindir. Lütfen önce kayıt olun."
      );
      await supabase.auth.signOut();
      return;
    }

    setView("orders");
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl">
          <p className="text-sm text-slate-600 text-center">
            Oturum kontrol ediliyor...
          </p>
        </div>
      </div>
    );
  }

  if (view === "orders") {
    return <OrdersView onSignOut={() => setView("login")} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col md:flex-row">
        {/* Sol: tanıtım bloğu */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-emerald-500 to-emerald-700 text-emerald-50 flex-col justify-between p-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Nöbetilaç Eczane Paneli
            </h1>
            <p className="mt-3 text-sm text-emerald-100">
              Mobil uygulamadan gelen reçete siparişlerini tek ekrandan
              görüntüleyin, onaylayın ve kuryeye yönlendirin.
            </p>
          </div>
          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100/20 border border-emerald-100/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-50" />
              </span>
              <div>
                <p className="font-semibold">Canlı sipariş bildirimi</p>
                <p className="text-emerald-100/90">
                  Yeni siparişlerde anında sesli ve görsel bildirim alın.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100/20 border border-emerald-100/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-50" />
              </span>
              <div>
                <p className="font-semibold">Kurye yönetimi</p>
                <p className="text-emerald-100/90">
                  En yakın uygun kuryeye otomatik atama ve teslim takibi.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100/20 border border-emerald-100/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-50" />
              </span>
              <div>
                <p className="font-semibold">Detaylı sipariş geçmişi</p>
                <p className="text-emerald-100/90">
                  Eski siparişlere ve teslim durumlarına tek tıkla ulaşın.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ: giriş formu */}
        <div className="w-full md:w-1/2 px-6 py-7 sm:px-8 sm:py-9">
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 text-center md:text-left">
              Eczane Girişi
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 text-center md:text-left">
              Paneli kullanmak için eczane hesabınızla giriş yapın.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-slate-700">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="eczane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-slate-700">Şifre</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition-colors"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </div>

          <div className="mt-6 text-xs text-slate-500 text-center space-y-1">
            <p>
              Eczane hesabınız yok mu?{" "}
              <a
                href="/signup"
                className="text-emerald-600 hover:text-emerald-500 font-semibold"
              >
                Kayıt olun
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
