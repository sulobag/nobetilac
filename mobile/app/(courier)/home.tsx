import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  startLocationTracking,
  stopLocationTracking,
} from "@/utils/courierLocation";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL || "http://localhost:3000";

/* ------------------------------------------------------------------ */
/*  Tipler                                                             */
/* ------------------------------------------------------------------ */

type CourierOrder = {
  id: string;
  status: string;
  prescription_no: string | null;
  note: string | null;
  created_at: string;
  pharmacies?: {
    name: string | null;
    city: string | null;
    district: string | null;
    phone: string | null;
    street?: string | null;
    building_no?: string | null;
  } | null;
  addresses?: {
    formatted_address?: string | null;
    city?: string | null;
    district?: string | null;
    neighborhood?: string | null;
    street?: string | null;
    building_no?: string | null;
  } | null;
  customer?: {
    full_name: string | null;
    phone: string | null;
  } | null;
};

type CourierRow = {
  id: string;
  user_id: string;
  is_available: boolean;
  vehicle_type: string;
};

type CourierApiResponse = {
  courier: CourierRow;
  activeOrder: CourierOrder | null;
  todayDelivered: number;
  error?: string;
};

/* ------------------------------------------------------------------ */
/*  Yardımcı: access token al                                         */
/* ------------------------------------------------------------------ */

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CourierHome() {
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const [isToggling, setIsToggling] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deliveryCodeInput, setDeliveryCodeInput] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  /* ---- Tek sorgu: API üzerinden kurye + aktif sipariş + teslim ---- */
  const {
    data: apiData,
    refetch: refetchAll,
  } = useQuery<CourierApiResponse | null, Error>({
    queryKey: ["courier-dashboard", user?.id],
    enabled: !!user,
    refetchInterval: 10_000, // Her 10 saniyede otomatik yenile
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;

      const res = await fetch(
        `${WEB_BASE_URL}/api/courier-orders?token=${encodeURIComponent(token)}`,
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Veri alınamadı");
      }

      return (await res.json()) as CourierApiResponse;
    },
  });

  const courier = apiData?.courier ?? null;
  const activeOrder = apiData?.activeOrder ?? null;
  const todayDelivered = apiData?.todayDelivered ?? 0;

  /* ---- Realtime: Postgres Changes (tüm orders) ---- */
  useEffect(() => {
    if (!courier?.id) return;

    const channel = (supabase as any)
      .channel(`courier_orders_pg_${courier.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload: any) => {
          const newRow = payload?.new;
          if (newRow?.courier_id === courier.id) {
            void refetchAll();
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [courier?.id, refetchAll]);

  /* ---- Realtime: Broadcast (assign-courier API'den direkt bildirim) ---- */
  useEffect(() => {
    if (!courier?.id) return;

    const broadcastChannel = (supabase as any)
      .channel(`courier_notify_${courier.id}`)
      .on("broadcast", { event: "new_order" }, () => {
        void refetchAll();
      })
      .subscribe();

    return () => {
      broadcastChannel.unsubscribe();
    };
  }, [courier?.id, refetchAll]);

  /* ---- Müsaitlik toggle ---- */
  const toggleAvailability = useCallback(async () => {
    if (!courier) return;
    setIsToggling(true);

    try {
      const newValue = !courier.is_available;

      await (supabase as any)
        .from("couriers")
        .update({ is_available: newValue })
        .eq("id", courier.id);

      if (newValue) {
        await startLocationTracking(courier.id);
      } else {
        stopLocationTracking();
      }

      await refetchAll();

      Alert.alert(
        newValue ? "Çevrimiçi" : "Çevrimdışı",
        newValue
          ? "Artık sipariş alabilirsiniz. Konumunuz takip ediliyor."
          : "Artık sipariş almayacaksınız.",
      );
    } catch (err: any) {
      Alert.alert("Hata", err?.message || "Durum güncellenirken hata oluştu.");
    } finally {
      setIsToggling(false);
    }
  }, [courier, refetchAll]);

  /* ---- Uygulama kapandığında konum durdur ---- */
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, []);

  /* ---- Sipariş aksiyonu (kabul/red/teslim) ---- */
  const handleOrderAction = useCallback(
    async (action: "accept" | "reject" | "deliver") => {
      if (!activeOrder || !user) return;

      // Teslim için kod kontrolü
      if (action === "deliver") {
        if (deliveryCodeInput.length !== 6) {
          Alert.alert("Hata", "Lütfen müşteriden aldığınız 6 haneli teslimat kodunu girin.");
          return;
        }
      }

      setActionLoading(true);

      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Oturum bulunamadı");

        const payload: Record<string, string> = {
          orderId: activeOrder.id,
          action,
          token,
        };

        if (action === "deliver") {
          payload.deliveryCode = deliveryCodeInput;
        }

        const res = await fetch(`${WEB_BASE_URL}/api/courier-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || "İşlem başarısız");
        }

        const messages: Record<string, string> = {
          accept: "Sipariş kabul edildi. İyi teslimatlar!",
          reject: "Sipariş reddedildi. Bir sonraki kuryeye iletilecek.",
          deliver: "Sipariş teslim edildi!",
        };

        Alert.alert("Başarılı", messages[action]);
        setDeliveryCodeInput("");
        void refetchAll();
      } catch (err: any) {
        Alert.alert("Hata", err?.message || "İşlem sırasında hata oluştu.");
      } finally {
        setActionLoading(false);
      }
    },
    [activeOrder, user, refetchAll, deliveryCodeInput],
  );

  /* ---- Çıkış ---- */
  const handleSignOut = () => {
    Alert.alert("Çıkış Yap", "Çıkış yapmak istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: async () => {
          stopLocationTracking();
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  /* ---- Yardımcı: adres biçimle ---- */
  const formatAddress = (addr: CourierOrder["addresses"]) => {
    if (!addr) return "Adres bilgisi yok";
    return (
      addr.formatted_address ||
      `${addr.neighborhood ?? ""} ${addr.street ?? ""} No:${addr.building_no ?? ""} ${addr.district ?? ""}/${addr.city ?? ""}`
    );
  };

  const formatPharmacyAddress = (ph: CourierOrder["pharmacies"]) => {
    if (!ph) return "Adres bilgisi yok";
    const parts = [
      ph.street ?? "",
      ph.building_no ? `No:${ph.building_no}` : "",
      ph.district ?? "",
      ph.city ?? "",
    ].filter(Boolean);
    return parts.join(" ").trim() || `${ph.district ?? ""}/${ph.city ?? ""}`;
  };

  const openInMaps = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      Alert.alert("Adres bulunamadı", "Haritada açmak için geçerli bir adres yok.");
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Hata", "Harita uygulaması açılamadı.");
    });
  }, []);

  const isOnline = courier?.is_available ?? false;

  /* ================================================================ */
  /*  UI                                                               */
  /* ================================================================ */

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        className={`px-5 pt-14 pb-5 ${isOnline ? "bg-emerald-600" : "bg-slate-700"}`}
      >
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-1 mr-3">
            <Text className="text-white text-xl font-bold">Kurye Paneli</Text>
            <Text className="text-white/70 text-sm mt-0.5">
              {profile?.full_name || "Kurye"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSignOut}
            className="px-3 py-2 rounded-xl bg-white/15"
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Müsaitlik Toggle */}
        <View className="bg-white rounded-2xl p-4">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 mr-3">
              <Text className="text-gray-900 text-base font-semibold">
                Müsaitlik Durumu
              </Text>
              <Text className="text-gray-500 text-xs mt-1">
                {isOnline
                  ? "Çevrimiçi - Sipariş alabilirsiniz"
                  : "Çevrimdışı - Sipariş almıyorsunuz"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={toggleAvailability}
              disabled={isToggling}
              className={`w-14 h-7 rounded-full justify-center px-0.5 ${
                isOnline ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              {isToggling ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View
                  className={`w-6 h-6 rounded-full bg-white shadow-sm ${
                    isOnline ? "self-end" : "self-start"
                  }`}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* İstatistikler */}
      <View className="px-5 mt-5">
        <Text className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Bugünün Özeti
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
            <View className="w-9 h-9 rounded-full bg-teal-50 items-center justify-center mb-2">
              <MaterialCommunityIcons
                name="package-variant-closed-check"
                size={18}
                color="#0D9488"
              />
            </View>
            <Text className="text-2xl font-bold text-gray-900">
              {todayDelivered}
            </Text>
            <Text className="text-[11px] text-gray-500 mt-0.5">
              Teslim Edilen
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
            <View className="w-9 h-9 rounded-full bg-amber-50 items-center justify-center mb-2">
              <MaterialCommunityIcons
                name="clock-outline"
                size={18}
                color="#D97706"
              />
            </View>
            <Text className="text-2xl font-bold text-gray-900">
              {activeOrder ? "1" : "0"}
            </Text>
            <Text className="text-[11px] text-gray-500 mt-0.5">
              Aktif Sipariş
            </Text>
          </View>
        </View>
      </View>

      {/* Aktif Sipariş */}
      <View className="px-5 mt-5 mb-8">
        <Text className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Aktif Sipariş
        </Text>

        {!activeOrder && (
          <View className="bg-white rounded-2xl p-6 items-center border border-gray-100">
            <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-3">
              <MaterialCommunityIcons
                name="package-variant"
                size={28}
                color="#9CA3AF"
              />
            </View>
            <Text className="text-sm font-medium text-gray-700">
              Aktif sipariş yok
            </Text>
            <Text className="text-xs text-gray-500 text-center mt-1 max-w-[240px]">
              {isOnline
                ? "Çevrimiçisiniz. Yeni siparişler burada görünecek."
                : "Çevrimiçi olduğunuzda siparişler otomatik atanacak."}
            </Text>
          </View>
        )}

        {activeOrder && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setDetailModalOpen(true)}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
          >
            {/* Durum çubuğu */}
            <View
              className={`px-4 py-2.5 flex-row items-center gap-2 ${
                activeOrder.status === "courier_assigned"
                  ? "bg-sky-50"
                  : "bg-indigo-50"
              }`}
            >
              <View className="flex-row items-center gap-1.5">
                {activeOrder.status === "courier_assigned" ? (
                  <>
                    <View className="relative">
                      <View className="w-2 h-2 rounded-full bg-sky-500" />
                    </View>
                    <Text className="text-xs font-semibold text-sky-700">
                      Onayınız Bekleniyor
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="truck-delivery"
                      size={14}
                      color="#4338CA"
                    />
                    <Text className="text-xs font-semibold text-indigo-700">
                      Teslimat Yolda
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Eczane bilgileri (sadece görüntüleme, harita için detaya gir) */}
            <View className="px-4 pt-3 pb-2">
              <View className="flex-row items-center gap-2 mb-1">
                <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center">
                  <MaterialCommunityIcons
                    name="hospital-building"
                    size={16}
                    color="#047857"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">
                    {activeOrder.pharmacies?.name || "Eczane"}
                  </Text>
                  <Text
                    className="text-[11px] text-gray-500 mt-0.5"
                    numberOfLines={1}
                  >
                    {formatPharmacyAddress(activeOrder.pharmacies)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Detaylar */}
            <View className="px-4 pb-3 space-y-2">
              {/* Müşteri */}
              <View className="flex-row items-center gap-2">
                <Ionicons name="person-outline" size={14} color="#6B7280" />
                <Text className="text-xs text-gray-700">
                  {activeOrder.customer?.full_name || "Müşteri"}
                  {activeOrder.customer?.phone
                    ? ` • ${activeOrder.customer.phone}`
                    : ""}
                </Text>
              </View>

              {/* Adres (sadece görüntüleme, harita için detaya gir) */}
              <View className="flex-row items-start gap-2">
                <Ionicons
                  name="location-outline"
                  size={14}
                  color="#6B7280"
                  style={{ marginTop: 1 }}
                />
                <View className="flex-1">
                  <Text
                    className="text-xs text-gray-700"
                    numberOfLines={2}
                  >
                    {formatAddress(activeOrder.addresses)}
                  </Text>
                  <Text className="text-[10px] text-gray-400 mt-0.5">
                    Detaylar için karta dokun
                  </Text>
                </View>
              </View>

              {/* Reçete */}
              {activeOrder.prescription_no && (
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name="document-text-outline"
                    size={14}
                    color="#6B7280"
                  />
                  <Text className="text-xs text-gray-700 font-mono">
                    {activeOrder.prescription_no}
                  </Text>
                </View>
              )}

              {/* Not - müşteri tarafında görüldüğü için burada gizlendi */}
            </View>

            {/* Kart altı - detay label */}
            <View className="border-t border-gray-100 px-4 py-2 flex-row justify-end">
              <Text className="text-[11px] font-semibold text-emerald-700">
                Detayları gör
              </Text>
            </View>

            {/* Aksiyon butonları */}
            <View className="border-t border-gray-100 px-4 py-3">
              {activeOrder.status === "courier_assigned" && (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => handleOrderAction("reject")}
                    disabled={actionLoading}
                    className="flex-1 bg-rose-50 border border-rose-200 rounded-xl py-3 items-center"
                    activeOpacity={0.8}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#E11D48" />
                    ) : (
                      <Text className="text-xs font-semibold text-rose-700">
                        Reddet
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleOrderAction("accept")}
                    disabled={actionLoading}
                    className="flex-[2] bg-emerald-600 rounded-xl py-3 items-center"
                    activeOpacity={0.8}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="#ECFDF5"
                        />
                        <Text className="text-xs font-semibold text-emerald-50">
                          Kabul Et
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {activeOrder.status === "in_transit" && (
                <View className="space-y-3">
                  {/* Kod girişi alanı */}
                  <View>
                    <Text className="text-[11px] font-semibold text-gray-500 uppercase mb-1.5">
                      Teslimat Doğrulama Kodu
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3">
                        <Ionicons
                          name="keypad-outline"
                          size={16}
                          color="#6B7280"
                          style={{ marginRight: 8 }}
                        />
                        <TextInput
                          value={deliveryCodeInput}
                          onChangeText={(t) =>
                            setDeliveryCodeInput(t.replace(/[^0-9]/g, "").slice(0, 6))
                          }
                          placeholder="6 haneli kodu girin"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          maxLength={6}
                          className="flex-1 py-3 text-base font-mono font-semibold text-gray-900 tracking-widest"
                        />
                        {deliveryCodeInput.length === 6 && (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#059669"
                          />
                        )}
                      </View>
                    </View>
                    <Text className="text-[10px] text-gray-400 mt-1">
                      Müşteriden aldığınız 6 haneli kodu girin
                    </Text>
                  </View>

                  {/* Teslim Et butonu */}
                  <TouchableOpacity
                    onPress={() => handleOrderAction("deliver")}
                    disabled={actionLoading || deliveryCodeInput.length !== 6}
                    className={`rounded-xl py-3.5 items-center ${
                      deliveryCodeInput.length === 6
                        ? "bg-teal-600"
                        : "bg-gray-200"
                    }`}
                    activeOpacity={0.8}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View className="flex-row items-center gap-2">
                        <MaterialCommunityIcons
                          name="package-variant-closed-check"
                          size={18}
                          color={
                            deliveryCodeInput.length === 6
                              ? "#F0FDFA"
                              : "#9CA3AF"
                          }
                        />
                        <Text
                          className={`text-sm font-semibold ${
                            deliveryCodeInput.length === 6
                              ? "text-teal-50"
                              : "text-gray-400"
                          }`}
                        >
                          Teslim Et
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Sipariş detay modalı */}
      <Modal
        visible={detailModalOpen && !!activeOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-5 max-h-[80%]">
            {activeOrder && (
              <ScrollView>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-sm font-semibold text-gray-900">
                    Sipariş Detayı
                  </Text>
                  <TouchableOpacity
                    onPress={() => setDetailModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <Ionicons name="close" size={16} color="#4B5563" />
                  </TouchableOpacity>
                </View>

                {/* Reçete ve zaman */}
                <View className="mb-3">
                  <Text className="text-[11px] font-semibold text-gray-400 uppercase">
                    Reçete No
                  </Text>
                  <Text className="mt-1 text-base font-semibold text-gray-900 font-mono">
                    {activeOrder.prescription_no || "-"}
                  </Text>
                  <Text className="mt-1 text-[11px] text-gray-500">
                    {new Date(activeOrder.created_at).toLocaleString("tr-TR")}
                  </Text>
                </View>

                {/* Müşteri bilgileri */}
                <View className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-3">
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center">
                      <Ionicons
                        name="person-outline"
                        size={16}
                        color="#047857"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[11px] font-semibold text-gray-400 uppercase">
                        Müşteri
                      </Text>
                      <Text className="text-sm font-semibold text-gray-900">
                        {activeOrder.customer?.full_name || "Müşteri"}
                      </Text>
                      {activeOrder.customer?.phone && (
                        <Text className="text-[11px] text-gray-600 mt-0.5">
                          {activeOrder.customer.phone}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Eczane bilgileri (haritada açılabilir) */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    openInMaps(
                      `${activeOrder.pharmacies?.name ?? ""} ${formatPharmacyAddress(
                        activeOrder.pharmacies,
                      )}`,
                    )
                  }
                  className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-3"
                >
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center">
                      <MaterialCommunityIcons
                        name="hospital-building"
                        size={16}
                        color="#047857"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[11px] font-semibold text-gray-400 uppercase">
                        Eczane
                      </Text>
                      <Text className="text-sm font-semibold text-gray-900">
                        {activeOrder.pharmacies?.name || "Eczane"}
                      </Text>
                      <Text className="text-[11px] text-gray-600 mt-0.5">
                        {formatPharmacyAddress(activeOrder.pharmacies)}
                      </Text>
                      <Text className="text-[10px] text-emerald-600 mt-1">
                        Haritada açmak için dokun
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Teslimat adresi (haritada açılabilir) */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openInMaps(formatAddress(activeOrder.addresses))}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-3"
                >
                  <View className="flex-row items-start gap-2">
                    <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mt-0.5">
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color="#2563EB"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[11px] font-semibold text-gray-400 uppercase">
                        Teslimat Adresi
                      </Text>
                      <Text className="text-sm text-gray-800 mt-0.5">
                        {formatAddress(activeOrder.addresses)}
                      </Text>
                      <Text className="text-[10px] text-emerald-600 mt-1">
                        Haritada açmak için dokun
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Not */}
                {activeOrder.note && (
                  <View className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-3">
                    <Text className="text-[11px] font-semibold text-gray-400 uppercase mb-1">
                      Müşteri Notu
                    </Text>
                    <Text className="text-sm text-gray-700">
                      {activeOrder.note}
                    </Text>
                  </View>
                )}

                {/* Alt bilgi */}
                <Text className="text-[10px] text-gray-400 text-center mt-2 mb-2">
                  Adresi harita uygulamanızda açmak için kopyalayıp
                  kullanabilirsiniz.
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
