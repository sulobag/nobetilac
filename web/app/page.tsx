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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-xl">
          <p className="text-sm text-slate-300 text-center">
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center text-emerald-400">
          Eczane Paneli
        </h1>
        <p className="text-sm text-slate-300 mb-6 text-center">
          Reçete numarası ile gelen siparişleri onaylayın.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-slate-200">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="eczane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-200">Şifre</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold py-2 text-sm transition-colors"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </div>

        <div className="mt-6 text-xs text-slate-400 text-center space-y-1">
          <p>
            Eczane hesabınız yok mu?{" "}
            <a
              href="/signup"
              className="text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              Kayıt olun
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
