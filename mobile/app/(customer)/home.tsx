import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

type OrderRow = {
  id: string;
  status: string;
  prescription_no: string;
  created_at: string;
  note?: string | null;
  delivery_code?: string | null;
  pharmacies?: {
    name: string | null;
    city: string | null;
    district: string | null;
  } | null;
  addresses?: {
    formatted_address?: string | null;
    city?: string | null;
    district?: string | null;
    neighborhood?: string | null;
    street?: string | null;
    building_no?: string | null;
  } | null;
  prescription_image_path?: string | null;
};

/* ---- Durum yardımcıları ---- */

const STATUS_LABELS: Record<string, string> = {
  pending: "Eczane Onayı Bekleniyor",
  approved: "Kurye Aranıyor",
  courier_assigned: "Kuryeye Atandı",
  in_transit: "Kurye Yolda",
  delivered: "Teslim Edildi",
  rejected: "Reddedildi",
};

const STATUS_COLORS: Record<
  string,
  { bg: string; border: string; text: string; icon: string; iconColor: string }
> = {
  pending: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: "time-outline",
    iconColor: "#D97706",
  },
  approved: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: "search-outline",
    iconColor: "#059669",
  },
  courier_assigned: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
    icon: "bicycle-outline",
    iconColor: "#0284C7",
  },
  in_transit: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    icon: "navigate-outline",
    iconColor: "#4338CA",
  },
  delivered: {
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
    icon: "checkmark-circle-outline",
    iconColor: "#0D9488",
  },
  rejected: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    icon: "close-circle-outline",
    iconColor: "#E11D48",
  },
};

function getStatusInfo(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.pending;
}

/* ---- Ana component ---- */

export default function CustomerHome() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [prescriptionImageUrl, setPrescriptionImageUrl] = useState<
    string | null
  >(null);
  const [loadingPrescriptionImage, setLoadingPrescriptionImage] =
    useState(false);

  const { data: activeOrders = [], isLoading: ordersLoading } = useQuery<
    OrderRow[],
    Error
  >({
    queryKey: ["customer-active-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error("Kullanıcı oturumu bulunamadı.");

      const { data, error } = await (supabase as any)
        .from("orders")
        .select(
          `
            id, status, prescription_no, created_at, note,
            prescription_image_path, delivery_code,
            pharmacies:pharmacy_id ( name, city, district ),
            addresses:address_id (
              formatted_address, city, district,
              neighborhood, street, building_no
            )
          `,
        )
        .eq("user_id", user.id)
        .in("status", [
          "pending",
          "approved",
          "courier_assigned",
          "in_transit",
        ])
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message || "Siparişler yüklenemedi.");
      return (data || []) as OrderRow[];
    },
  });

  // Gerçek zamanlı güncelleme
  useEffect(() => {
    if (!user) return;

    const channel = (supabase as any)
      .channel(`home_orders_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["customer-active-orders", user.id],
          });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, queryClient]);

  const closeOrderModal = () => {
    setSelectedOrder(null);
    setPrescriptionImageUrl(null);
    setLoadingPrescriptionImage(false);
  };

  const formatAddress = (addr: OrderRow["addresses"]) => {
    if (!addr) return "Adres bilgisi yok";
    return (
      addr.formatted_address ||
      `${addr.neighborhood ?? ""} ${addr.street ?? ""} No:${addr.building_no ?? ""} ${addr.district ?? ""}/${addr.city ?? ""}`
    );
  };

  /* ---- Sipariş kartı renderı ---- */
  const renderOrderCard = ({ item }: { item: OrderRow }) => {
    const si = getStatusInfo(item.status);
    const isInTransit = item.status === "in_transit";

    return (
      <TouchableOpacity
        onPress={() => setSelectedOrder(item)}
        className="mb-3 rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm"
        activeOpacity={0.9}
      >
        {/* Durum çubuğu */}
        <View className={`px-4 py-2 flex-row items-center gap-2 ${si.bg}`}>
          <Ionicons
            name={si.icon as any}
            size={14}
            color={si.iconColor}
          />
          <Text className={`text-xs font-semibold ${si.text}`}>
            {STATUS_LABELS[item.status] || "Bekliyor"}
          </Text>
        </View>

        <View className="px-4 py-3">
          {/* Eczane */}
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center">
              <MaterialCommunityIcons
                name="hospital-building"
                size={16}
                color="#047857"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900">
                {item.pharmacies?.name || "Eczane"}
              </Text>
              {item.pharmacies?.district && item.pharmacies?.city && (
                <Text className="text-[11px] text-gray-500">
                  {item.pharmacies.district}/{item.pharmacies.city}
                </Text>
              )}
            </View>
          </View>

          {/* Adres */}
          <View className="flex-row items-start gap-2 mb-1.5">
            <Ionicons
              name="location-outline"
              size={14}
              color="#6B7280"
              style={{ marginTop: 1 }}
            />
            <Text
              className="text-xs text-gray-600 flex-1"
              numberOfLines={1}
            >
              {formatAddress(item.addresses)}
            </Text>
          </View>

          {/* Reçete + tarih */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="document-text-outline"
                size={13}
                color="#6B7280"
              />
              <Text className="text-xs text-gray-600 font-mono">
                {item.prescription_no || "-"}
              </Text>
            </View>
            <Text className="text-[10px] text-gray-400">
              {new Date(item.created_at).toLocaleString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          {/* Teslimat kodu (sadece in_transit durumunda) */}
          {isInTransit && item.delivery_code && (
            <View className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <View className="flex-row items-center gap-2 mb-1">
                <Ionicons name="key-outline" size={14} color="#4338CA" />
                <Text className="text-[11px] font-semibold text-indigo-700 uppercase">
                  Teslimat Kodu
                </Text>
              </View>
              <Text className="text-2xl font-bold text-indigo-900 tracking-[8px] text-center mt-1">
                {item.delivery_code}
              </Text>
              <Text className="text-[10px] text-indigo-500 text-center mt-1">
                Bu kodu kuryeye söyleyin
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-gray-50 pb-20">
      {/* Header */}
      <View className="mt-12 mx-6 mb-6">
        <View style={styles.headerBackground} />
        <View className="rounded-3xl px-5 py-6" style={styles.glassCard}>
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-xs font-semibold text-emerald-100 uppercase">
                Nöbet İlaç
              </Text>
              <Text className="text-2xl font-bold text-white mt-1">
                Merhaba{profile?.full_name ? `, ${profile.full_name}` : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(customer)/profile")}
              className="ml-3"
            >
              <Ionicons
                name="person-circle-outline"
                size={30}
                color="#ECFDF5"
              />
            </TouchableOpacity>
          </View>
          <Text className="text-emerald-100 mt-2 text-sm">
            Reçetenizi girin, en uygun eczaneye yönlendirelim.
          </Text>
        </View>
      </View>

      {/* Nasıl Çalışır - Roadmap */}
      <View className="px-6 mb-4">
        <View className="bg-white rounded-2xl border border-emerald-50 px-4 py-4 shadow-sm">
          <Text className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">
            Nasıl Çalışır?
          </Text>
          <View className="flex-row justify-between">
            <View className="flex-1 mr-2">
              <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center mb-1">
                <MaterialCommunityIcons
                  name="pill"
                  size={16}
                  color="#047857"
                />
              </View>
              <Text className="text-[11px] font-semibold text-gray-800">
                1. Reçeteni Gir
              </Text>
              <Text className="text-[10px] text-gray-500 mt-0.5">
                Reçete numarası veya fotoğrafı ile sipariş oluştur.
              </Text>
            </View>
            <View className="flex-1 mx-1">
              <View className="w-8 h-8 rounded-full bg-sky-50 items-center justify-center mb-1">
                <MaterialCommunityIcons
                  name="hospital-building"
                  size={16}
                  color="#0284C7"
                />
              </View>
              <Text className="text-[11px] font-semibold text-gray-800">
                2. Eczane Onaylasın
              </Text>
              <Text className="text-[10px] text-gray-500 mt-0.5">
                Eczane reçeteni kontrol edip siparişi hazırlar.
              </Text>
            </View>
            <View className="flex-1 ml-2">
              <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center mb-1">
                <MaterialCommunityIcons
                  name="motorbike"
                  size={16}
                  color="#4338CA"
                />
              </View>
              <Text className="text-[11px] font-semibold text-gray-800">
                3. Kurye Teslim Etsin
              </Text>
              <Text className="text-[10px] text-gray-500 mt-0.5">
                Kurye geldiğinde ekrandaki 6 haneli kodu söyle, teslimi onayla.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Aktif Siparişler */}
      <View className="flex-1 px-6">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-sm font-semibold text-gray-800">
              Aktif Siparişler
            </Text>
            <Text className="text-[11px] text-gray-500 mt-0.5">
              Teslim edilene kadar burada görünür
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(customer)/orders")}
            className="px-3 py-1.5 rounded-full bg-white border border-emerald-100"
          >
            <Text className="text-[11px] font-semibold text-emerald-700">
              Tüm Siparişler
            </Text>
          </TouchableOpacity>
        </View>

        {ordersLoading ? (
          <View className="mt-6 items-center justify-center">
            <ActivityIndicator size="small" color="#059669" />
            <Text className="mt-2 text-xs text-gray-500">
              Siparişleriniz yükleniyor...
            </Text>
          </View>
        ) : activeOrders.length === 0 ? (
          <View className="mt-2 rounded-2xl bg-white border border-gray-100 px-5 py-6 items-center">
            <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-3">
              <MaterialCommunityIcons
                name="package-variant"
                size={28}
                color="#9CA3AF"
              />
            </View>
            <Text className="text-sm font-medium text-gray-700">
              Aktif siparişiniz yok
            </Text>
            <Text className="text-xs text-gray-500 text-center mt-1 max-w-[260px]">
              Yeni bir sipariş oluşturduğunuzda burada takip edebilirsiniz.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(customer)/order-by-barcode")}
              className="mt-4 px-5 py-2.5 rounded-full bg-emerald-600"
            >
              <Text className="text-xs font-semibold text-white">
                Reçete ile sipariş ver
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={activeOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={renderOrderCard}
            ListFooterComponent={
              activeOrders.length > 0
                ? () => (
                    <View className="mt-2">
                      <Text className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                        Sık Kullanılanlar
                      </Text>
                      <View className="flex-row gap-3">
                        <TouchableOpacity
                          onPress={() =>
                            router.push("/(customer)/addresses")
                          }
                          className="flex-1 bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm"
                          activeOpacity={0.9}
                        >
                          <View className="flex-row items-center mb-1">
                            <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center mr-2">
                              <Ionicons
                                name="location-outline"
                                size={18}
                                color="#047857"
                              />
                            </View>
                            <Text className="text-xs font-semibold text-gray-900">
                              Adreslerim
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            router.push("/(customer)/pharmacies")
                          }
                          className="flex-1 bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm"
                          activeOpacity={0.9}
                        >
                          <View className="flex-row items-center mb-1">
                            <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center mr-2">
                              <MaterialCommunityIcons
                                name="hospital-building"
                                size={18}
                                color="#047857"
                              />
                            </View>
                            <Text className="text-xs font-semibold text-gray-900">
                              Eczaneler
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                : null
            }
          />
        )}
      </View>

      {/* Bottom navigation bar */}
      <View className="absolute inset-x-4 bottom-5">
        <View className="flex-row items-center justify-between rounded-full bg-white border border-emerald-100 shadow-lg px-5 py-3">
          <TouchableOpacity
            onPress={() => router.push("/(customer)/pharmacies")}
            className="flex-1 items-center justify-center"
          >
            <MaterialCommunityIcons
              name="hospital-building"
              size={20}
              color="#047857"
            />
            <Text className="mt-1 text-[11px] font-semibold text-gray-700">
              Eczaneler
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(customer)/orders")}
            className="flex-1 mx-2 items-center justify-center"
          >
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={20}
              color="#047857"
            />
            <Text className="mt-1 text-[11px] font-semibold text-gray-700">
              Siparişlerim
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(customer)/order-by-barcode")}
            className="flex-1 ml-1 flex-row items-center justify-center rounded-full bg-emerald-600 py-2"
          >
            <MaterialCommunityIcons
              name="pill"
              size={20}
              color="#ECFDF5"
              style={{ marginRight: 6 }}
            />
            <Text className="text-xs font-semibold text-emerald-50">
              Sipariş Ver
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sipariş detay modalı */}
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="fade"
        onRequestClose={closeOrderModal}
      >
        <View className="flex-1 bg-black/40 justify-center px-5">
          <View className="bg-white rounded-2xl overflow-hidden max-h-[85%]">
            {selectedOrder && (
              <>
                {/* Modal header - durum çubuğu */}
                <View
                  className={`px-5 py-3 flex-row items-center justify-between ${
                    getStatusInfo(selectedOrder.status).bg
                  }`}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name={getStatusInfo(selectedOrder.status).icon as any}
                      size={16}
                      color={getStatusInfo(selectedOrder.status).iconColor}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        getStatusInfo(selectedOrder.status).text
                      }`}
                    >
                      {STATUS_LABELS[selectedOrder.status] || "Bekliyor"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={closeOrderModal}
                    className="w-7 h-7 rounded-full bg-black/10 items-center justify-center"
                  >
                    <Ionicons name="close" size={16} color="#374151" />
                  </TouchableOpacity>
                </View>

                <ScrollView className="px-5 py-4">
                  {/* Teslimat kodu - belirgin şekilde */}
                  {selectedOrder.status === "in_transit" &&
                    selectedOrder.delivery_code && (
                      <View className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 mb-4">
                        <View className="flex-row items-center gap-2 mb-2">
                          <Ionicons
                            name="key-outline"
                            size={16}
                            color="#4338CA"
                          />
                          <Text className="text-xs font-semibold text-indigo-700 uppercase">
                            Teslimat Doğrulama Kodu
                          </Text>
                        </View>
                        <Text className="text-3xl font-bold text-indigo-900 tracking-[10px] text-center">
                          {selectedOrder.delivery_code}
                        </Text>
                        <Text className="text-[11px] text-indigo-500 text-center mt-2">
                          Kuryeye teslim sırasında bu kodu söyleyin
                        </Text>
                      </View>
                    )}

                  {/* Reçete bilgisi */}
                  <View className="mb-3">
                    <Text className="text-[11px] font-semibold text-gray-400 uppercase">
                      Reçete No
                    </Text>
                    <Text className="text-lg font-semibold text-gray-900 font-mono mt-0.5">
                      {selectedOrder.prescription_no || "-"}
                    </Text>
                    <Text className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(selectedOrder.created_at).toLocaleString(
                        "tr-TR",
                      )}
                    </Text>
                  </View>

                  {/* Eczane */}
                  <View className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-3">
                    <View className="flex-row items-center gap-2">
                      <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center">
                        <MaterialCommunityIcons
                          name="hospital-building"
                          size={14}
                          color="#047857"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-semibold text-gray-400 uppercase">
                          Eczane
                        </Text>
                        <Text className="text-sm font-semibold text-gray-900">
                          {selectedOrder.pharmacies?.name || "Bilgi yok"}
                        </Text>
                        {selectedOrder.pharmacies?.district &&
                          selectedOrder.pharmacies?.city && (
                            <Text className="text-[11px] text-gray-500">
                              {selectedOrder.pharmacies.district}/
                              {selectedOrder.pharmacies.city}
                            </Text>
                          )}
                      </View>
                    </View>
                  </View>

                  {/* Adres */}
                  <View className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-3">
                    <View className="flex-row items-start gap-2">
                      <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mt-0.5">
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color="#2563EB"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-semibold text-gray-400 uppercase">
                          Teslimat Adresi
                        </Text>
                        <Text className="text-sm text-gray-800 mt-0.5">
                          {formatAddress(selectedOrder.addresses)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Not */}
                  {selectedOrder.note && (
                    <View className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-3">
                      <Text className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
                        Not
                      </Text>
                      <Text className="text-sm text-gray-700">
                        {selectedOrder.note}
                      </Text>
                    </View>
                  )}

                  {/* Reçete fotoğrafı */}
                  {selectedOrder.prescription_image_path && (
                    <View className="mb-3">
                      <Text className="text-[10px] font-semibold text-gray-400 uppercase mb-2">
                        Reçete Fotoğrafı
                      </Text>
                      {prescriptionImageUrl ? (
                        <View className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden max-h-72 items-center justify-center">
                          <Image
                            source={{ uri: prescriptionImageUrl }}
                            style={{ width: "100%", height: 260 }}
                            contentFit="contain"
                          />
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              setLoadingPrescriptionImage(true);
                              const { data } =
                                await supabase.auth.getSession();
                              const token = data.session?.access_token;
                              if (!token) {
                                Alert.alert(
                                  "Hata",
                                  "Oturum bilgisi alınamadı.",
                                );
                                return;
                              }
                              const baseUrl =
                                process.env.EXPO_PUBLIC_WEB_BASE_URL ??
                                "http://localhost:3000";
                              const url = `${baseUrl}/api/prescription-image?orderId=${selectedOrder.id}&token=${encodeURIComponent(token)}`;
                              setPrescriptionImageUrl(url);
                            } catch (e) {
                              const msg =
                                e instanceof Error ? e.message : String(e);
                              Alert.alert("Hata", `Fotoğraf yüklenemedi: ${msg}`);
                            } finally {
                              setLoadingPrescriptionImage(false);
                            }
                          }}
                          disabled={loadingPrescriptionImage}
                          className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex-row items-center gap-2"
                        >
                          <Ionicons
                            name="image-outline"
                            size={14}
                            color="#059669"
                          />
                          <Text className="text-xs font-semibold text-emerald-700">
                            {loadingPrescriptionImage
                              ? "Yükleniyor..."
                              : "Reçete fotoğrafını görüntüle"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Boşluk */}
                  <View className="h-4" />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBackground: {
    position: "absolute",
    inset: 0,
    borderRadius: 24,
    backgroundColor: "#059669",
  },
  glassCard: {
    backgroundColor: "rgba(15, 118, 110, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(240, 253, 250, 0.7)",
  },
});
