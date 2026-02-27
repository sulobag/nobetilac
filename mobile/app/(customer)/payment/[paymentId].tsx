import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL || "http://localhost:3000";

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ paymentId: string }>();
  const paymentId = params.paymentId;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // debug amaçlı kullanılan state'ler kaldırıldı

  const statusRef = useRef<string | null>(null);
  const htmlRef = useRef<string | null>(null);
  const lastSyncAtRef = useRef<number>(0);
  const successAnim = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);

  const originWhitelist = useMemo(() => ["*"], []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    htmlRef.current = html;
  }, [html]);

  const safeGoBack = () => {
    try {
      // Eğer geri gidilebilecek bir ekran yoksa, fallback olarak siparişler sayfasına yönlendir
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(customer)/orders");
      }
    } catch {
      router.replace("/(customer)/orders");
    }
  };

  const wrappedHtml = useMemo(() => {
    if (!html) return null;
    // Eğer iyzico zaten full HTML dönmüşse (nadiren), tekrar sarmalama.
    if (/<html[\s>]/i.test(html) || /<body[\s>]/i.test(html)) return html;
    // iyzico'dan gelen snippet'i full HTML içine alıp hata/log yakalayalım
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>
      html, body { height: 100%; }
      body { margin: 0; padding: 0; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial; }
      #root { padding: 12px; }
      #iyzipay-checkout-form { min-height: 720px; }
    </style>
    <script>
      (function () {
        function send(type, payload) {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
            }
          } catch (e) {}
        }
        window.addEventListener('error', function (event) {
          send('error', { message: String(event.message || 'error'), filename: event.filename, lineno: event.lineno, colno: event.colno });
        });
        window.addEventListener('unhandledrejection', function (event) {
          send('promiseRejection', { reason: String(event.reason || 'rejection') });
        });
        var _log = console.log;
        console.log = function () {
          try { send('log', Array.prototype.slice.call(arguments).map(String).join(' ')); } catch (e) {}
          try { _log.apply(console, arguments); } catch (e) {}
        };
        send('ready', { ua: navigator.userAgent, href: String(location.href) });
      })();
    </script>
  </head>
  <body>
    <div id="root">
      <div id="iyzipay-checkout-form"></div>
      ${html}
    </div>
  </body>
</html>`;
  }, [html]);

  const loadCheckout = async () => {
    if (!paymentId) {
      setError("paymentId bulunamadı.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Oturum bilgisi alınamadı.");

      const res = await fetch(`${WEB_BASE_URL}/api/iyzico-checkout-initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, token }),
      });
      const r: any = await res.json();
      if (!res.ok)
        throw new Error(
          [r?.error, r?.errorCode ? `(${r.errorCode})` : null].filter(Boolean).join(" ") ||
            "Checkout başlatılamadı",
        );

      setHtml(r.checkoutFormContent as string);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocalStatus = async (opts?: { silent?: boolean }) => {
    if (!paymentId) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Oturum bilgisi alınamadı.");

      const sRes = await fetch(
        `${WEB_BASE_URL}/api/payment-status?paymentId=${encodeURIComponent(
          paymentId,
        )}&token=${encodeURIComponent(token)}`,
      );
      const s: any = await sRes.json();
      if (sRes.ok) setStatus(s.status as string);
    } catch (e) {
      if (opts?.silent) return;
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Hata", msg);
    }
  };

  const syncFromIyzico = async () => {
    if (!paymentId) return;
    const now = Date.now();
    if (now - lastSyncAtRef.current < 15000) return; // 15sn'den sık sync yapma
    lastSyncAtRef.current = now;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    await fetch(`${WEB_BASE_URL}/api/iyzico-checkout-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, token }),
    }).catch(() => {});
  };

  const checkStatus = async () => {
    if (!paymentId) return;
    setChecking(true);
    try {
      // manuel butonda sync + status
      await syncFromIyzico();
      await fetchLocalStatus({ silent: false });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void loadCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  // hafif polling: ödeme durumunu takip et
  useEffect(() => {
    let timer: any = null;
    timer = setInterval(() => {
      void fetchLocalStatus({ silent: true });
      // Form açıldıysa arada bir iyzico sync yap (ödeme yapılınca paid'a düşmesi için)
      if (htmlRef.current && statusRef.current !== "paid") {
        void syncFromIyzico();
      }
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  useEffect(() => {
    if (status === "paid" && !showSuccess) {
      setShowSuccess(true);
      // Sipariş listelerini tazeleyelim
      if (user?.id) {
        void queryClient.invalidateQueries({
          queryKey: ["customer-active-orders", user.id],
        });
        void queryClient.invalidateQueries({
          queryKey: ["customer-orders", user.id],
        });
      } else {
        void queryClient.invalidateQueries({
          queryKey: ["customer-active-orders"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["customer-orders"],
        });
      }
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSuccess(false);
        safeGoBack();
      });
    }
    // safeGoBack bağımlılığı bilerek eklenmedi; router referansı sabit kabul ediliyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, showSuccess, successAnim, user, queryClient]);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-6">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={safeGoBack}>
            <Text className="text-emerald-600 text-base">← Geri</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={checkStatus} disabled={checking}>
            <Text className="text-gray-700 text-sm font-semibold">
              {checking ? "Kontrol..." : "Durum Kontrol"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text className="text-2xl font-bold text-gray-900 mt-3">Ödeme</Text>
        {status && (
          <Text className="text-xs text-gray-500 mt-1">
            Durum: <Text className="font-mono">{status}</Text>
          </Text>
        )}
      </View>

      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="text-gray-600 mt-4">Ödeme formu hazırlanıyor...</Text>
        </View>
      )}

      {!loading && error && (
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="text-emerald-700 font-semibold mt-4 mb-2">
            Ödeme durumu kontrol ediliyor
          </Text>
          <Text className="text-gray-600 text-center text-xs">
            Bankanızdan veya iyzico sunucularından yanıt bekliyoruz. Lütfen bu
            ekrandan çıkmayın, sonuç birkaç saniye içinde güncellenecektir.
          </Text>
        </View>
      )}

      {!loading && !error && html && (
        <WebView
          originWhitelist={originWhitelist}
          source={{ html: wrappedHtml || html, baseUrl: WEB_BASE_URL }}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          setSupportMultipleWindows
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onMessage={() => {
            // şu an için mesajları UI'da göstermiyoruz
          }}
          onError={(e) => {
            const msg = e.nativeEvent?.description || "WebView hata";
            setError(msg);
          }}
          onHttpError={(e) => {
            setError(`HTTP hata: ${e.nativeEvent.statusCode}`);
          }}
        />
      )}

      {showSuccess && (
        <Animated.View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 40,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 9999,
            backgroundColor: "#059669",
            flexDirection: "row",
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 6,
            opacity: successAnim,
            transform: [
              {
                translateY: successAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "#ECFDF5",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#059669", fontWeight: "bold", fontSize: 14 }}>✓</Text>
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text
              style={{
                color: "#ECFDF5",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Ödeme başarılı
            </Text>
            <Text
              style={{
                color: "#D1FAE5",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              Siparişiniz kuryeye iletiliyor.
            </Text>
          </View>
        </Animated.View>
      )}

    </View>
  );
}

