"use client";

import { useEffect, useMemo, useState } from "react";

function useQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export default function CheckoutClient({ paymentId }: { paymentId: string }) {
  const token = useMemo(() => useQueryParam("token"), []);
  const [html, setHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setError("token parametresi eksik. Lütfen uygulamadan tekrar deneyin.");
        return;
      }

      setError(null);
      setStatus(null);

      const res = await fetch("/api/iyzico-checkout-initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Checkout başlatılamadı");
        return;
      }

      setHtml(data.checkoutFormContent as string);
    };

    void run();
  }, [paymentId, token]);

  // status polling (callback gelirse DB güncellenecek)
  useEffect(() => {
    if (!token) return;
    let timer: any = null;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/payment-status?paymentId=${encodeURIComponent(
            paymentId,
          )}&token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (res.ok) {
          setStatus(data.status);
        }
      } catch {
        // ignore
      }
    };
    void poll();
    timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [paymentId, token]);

  const showSuccess = status === "paid";
  const showFail = status === "failed";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900">
            Ödeme Ekranı
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Ödeme tamamlanınca bu ekran otomatik güncellenecek.
          </p>
        </div>

        <div className="px-5 py-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!error && showSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Ödeme alındı. Uygulamaya geri dönebilirsiniz.
            </div>
          )}

          {!error && showFail && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Ödeme başarısız görünüyor. Tekrar deneyebilir veya siparişi iptal
              edebilirsiniz.
            </div>
          )}

          {!error && status && (
            <p className="mt-3 text-xs text-slate-500">
              Durum: <span className="font-mono">{status}</span>
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!token) return;
                setSyncing(true);
                try {
                  await fetch("/api/iyzico-checkout-sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paymentId, token }),
                  });
                } finally {
                  setSyncing(false);
                }
              }}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50"
              disabled={syncing}
            >
              {syncing ? "Kontrol ediliyor..." : "Ödemeyi Kontrol Et"}
            </button>
            <a
              href="#form"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-600"
            >
              Ödeme formuna git
            </a>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div id="form" className="rounded-xl bg-white border border-slate-200 p-3">
            {!html && !error && (
              <div className="flex items-center gap-3 py-6 justify-center text-slate-600 text-sm">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                Ödeme formu hazırlanıyor...
              </div>
            )}
            {html && (
              <iframe
                title="iyzico-checkout"
                className="w-full rounded-lg border border-slate-200"
                style={{ height: 700 }}
                // innerHTML ile eklenen scriptler çoğu tarayıcıda çalışmaz.
                // iframe srcDoc ile iyzico checkout içeriğini çalıştırıyoruz.
                srcDoc={html}
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

