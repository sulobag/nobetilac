/*
  Not: Geocoding için aşağıdaki .env.local ayarını eklediğinden emin ol:
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
*/

"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type GeocodeResult = {
  results: {
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }[];
  status: string;
};

type Step = "form" | "verify";

export default function PharmacySignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [street, setStreet] = useState("");
  const [buildingNo, setBuildingNo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [code, setCode] = useState("");

  const geocodeAddress = async (): Promise<{
    lat: number | null;
    lng: number | null;
  }> => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.warn(
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY tanımlı değil, geocoding atlanıyor."
      );
      return { lat: null, lng: null };
    }

    const parts = [street, buildingNo, neighborhood, district, city].filter(
      Boolean
    );

    if (parts.length === 0) {
      return { lat: null, lng: null };
    }

    const address = encodeURIComponent(parts.join(" "));
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${apiKey}`;

    try {
      const res = await fetch(url);
      const data = (await res.json()) as GeocodeResult;

      if (data.status === "OK" && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        return { lat, lng };
      }

      console.warn("Geocoding başarısız:", data.status);
      return { lat: null, lng: null };
    } catch (error) {
      console.error("Geocoding hata:", error);
      return { lat: null, lng: null };
    }
  };

  const handleSignup = async () => {
    setError(null);
    setSuccess(null);

    if (!name || !email || !password) {
      setError("İsim, email ve şifre zorunludur.");
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email: email.trim().toLowerCase(),
          password,
        }
      );

      if (signUpError) {
        throw signUpError;
      }

      if (authData.user && authData.session) {
        const { lat, lng } = await geocodeAddress();

        const { error: pharmacyError } = await (supabase as any)
          .from("pharmacies")
          .insert({
            user_id: authData.user.id,
            name,
            phone: phone || null,
            city: city || null,
            district: district || null,
            neighborhood: neighborhood || null,
            street: street || null,
            building_no: buildingNo || null,
            latitude: lat,
            longitude: lng,
          });

        if (pharmacyError) {
          throw pharmacyError;
        }

        setSuccess(
          "Eczane kaydınız oluşturuldu. Artık giriş ekranından giriş yapabilirsiniz."
        );
      } else {
        setSuccess(
          "Hesabınız oluşturuldu. Emailinize doğrulama kodu gönderildi, lütfen kodu girerek hesabınızı onaylayın."
        );
        setStep("verify");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    setSuccess(null);

    if (!code) {
      setError("Lütfen doğrulama kodunu girin.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "signup",
      });

      if (verifyError) {
        throw verifyError;
      }

      const userId = data?.user?.id;

      if (!userId) {
        throw new Error("Kullanıcı bilgisi alınamadı. Lütfen tekrar deneyin.");
      }

      const { lat, lng } = await geocodeAddress();

      const { error: pharmacyError } = await (supabase as any)
        .from("pharmacies")
        .insert({
          user_id: userId,
          name,
          phone: phone || null,
          city: city || null,
          district: district || null,
          neighborhood: neighborhood || null,
          street: street || null,
          building_no: buildingNo || null,
          latitude: lat,
          longitude: lng,
        });

      if (pharmacyError) {
        throw pharmacyError;
      }

      setSuccess(
        "Eczane kaydınız ve hesabınız başarıyla onaylandı. Artık giriş ekranından giriş yapabilirsiniz."
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (step === "verify") {
    return (
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center text-emerald-400">
          Email Doğrulama
        </h1>
        <p className="text-sm text-slate-300 mb-6 text-center">
          {email} adresine gönderilen doğrulama kodunu girerek hesabınızı
          onaylayın.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-slate-200">
              Doğrulama Kodu
            </label>
            <input
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 tracking-widest"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-800 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          <button
            onClick={handleVerifyCode}
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold py-2 text-sm transition-colors"
          >
            {loading ? "Onaylanıyor..." : "Kodu Onayla"}
          </button>

          <p className="mt-2 text-xs text-slate-400 text-center">
            Kodu almadıysanız birkaç dakika bekleyip tekrar deneyin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-xl">
      <h1 className="text-2xl font-bold mb-2 text-center text-emerald-400">
        Eczane Kayıt
      </h1>
      <p className="text-sm text-slate-300 mb-6 text-center">
        Eczanenizi kayıt edin ve mobil uygulamadan gelen siparişleri yönetin.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 text-slate-200">
            Eczane Adı
          </label>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Örn: Merkez Eczanesi"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

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

        <div>
          <label className="block text-sm mb-1 text-slate-200">Telefon</label>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="0 5XX XXX XX XX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-slate-200">Şehir</label>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="İstanbul"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-slate-200">İlçe</label>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Kadıköy"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-slate-200">Mahalle</label>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Caferağa"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-slate-200">
            Cadde / Sokak
          </label>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Moda Caddesi"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-slate-200">Bina No</label>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="42"
            value={buildingNo}
            onChange={(e) => setBuildingNo(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-4 text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-800 rounded-lg px-3 py-2">
          {success}
        </p>
      )}

      <button
        onClick={handleSignup}
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold py-2 text-sm transition-colors"
      >
        {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
      </button>

      <p className="mt-4 text-xs text-slate-400 text-center">
        Zaten bir hesabınız varsa, giriş ekranına dönün ve giriş yapın.
      </p>
    </div>
  );
}
