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
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";

type OrderRow = {
  id: string;
  status: string;
  prescription_no: string;
  created_at: string;
  note?: string | null;
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

export default function CustomerHome() {
  const router = useRouter();
  const { profile } = useAuth();

  const { user } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [prescriptionImageUrl, setPrescriptionImageUrl] = useState<string | null>(
    null,
  );
  const [loadingPrescriptionImage, setLoadingPrescriptionImage] = useState(false);

  const {
    data: activeOrders = [],
    isLoading: ordersLoading,
  } = useQuery<OrderRow[], Error>({
    queryKey: ["customer-active-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) {
        throw new Error("Kullanıcı oturumu bulunamadı.");
      }

      const { data, error } = await (supabase as any)
        .from("orders")
        .select(
          `
            id,
            status,
            prescription_no,
            created_at,
            note,
            prescription_image_path,
            pharmacies:pharmacy_id (
              name,
              city,
              district
            ),
            addresses:address_id (
              formatted_address,
              city,
              district,
              neighborhood,
              street,
              building_no
            )
          `,
        )
        .eq("user_id", user.id)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message || "Siparişler yüklenemedi.");
      }

      return (data || []) as OrderRow[];
    },
  });

  const getStatusLabel = (status: string) => {
    if (status === "approved") return "Onaylandı";
    if (status === "rejected") return "Reddedildi";
    return "Bekliyor";
  };

  const getStatusColors = (status: string) => {
    if (status === "approved") {
      return "bg-emerald-50 border-emerald-200 text-emerald-700";
    }
    if (status === "rejected") {
      return "bg-rose-50 border-rose-200 text-rose-700";
    }
    return "bg-amber-50 border-amber-200 text-amber-700";
  };

  const closeOrderModal = () => {
    setSelectedOrder(null);
    setPrescriptionImageUrl(null);
    setLoadingPrescriptionImage(false);
  };

  return (
    <View className="flex-1 bg-gray-50 pb-20">
      {/* Header - Liquid Glass */}
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

      {/* Aktif Siparişler */}
      <View className="flex-1 px-6">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
              Aktif Siparişler
            </Text>
            <Text className="text-xs text-gray-500">
              Bekleyen ve onaylanan siparişleriniz
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(customer)/orders")}
            className="px-3 py-1 rounded-full bg-white border border-emerald-100"
          >
            <Text className="text-[11px] font-semibold text-emerald-700">
              Tümünü Gör
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
          <View className="mt-4 rounded-2xl bg-white border border-dashed border-emerald-200 px-4 py-5">
            <Text className="text-sm font-semibold text-gray-900 mb-1">
              Aktif siparişiniz yok
            </Text>
            <Text className="text-xs text-gray-600 mb-3">
              Yeni bir sipariş oluşturduğunuzda burada görebilirsiniz.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(customer)/order-by-barcode")}
              className="self-start px-4 py-2 rounded-full bg-emerald-600"
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
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedOrder(item)}
                className="mb-3 rounded-2xl bg-white border border-gray-100 px-4 py-3 shadow-sm"
                activeOpacity={0.9}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-2">
                    <Text className="text-[11px] font-semibold text-gray-500 uppercase">
                      Reçete No
                    </Text>
                    <Text className="mt-1 text-base font-semibold text-gray-900 font-mono">
                      {item.prescription_no || "-"}
                    </Text>
                    <Text className="mt-1 text-[11px] text-gray-500">
                      {new Date(item.created_at).toLocaleString("tr-TR")}
                    </Text>
                    {item.pharmacies && (
                      <Text
                        className="mt-1 text-[11px] text-gray-600"
                        numberOfLines={1}
                      >
                        Eczane: {item.pharmacies.name}
                        {item.pharmacies.district && item.pharmacies.city
                          ? ` - ${item.pharmacies.district}/${item.pharmacies.city}`
                          : ""}
                      </Text>
                    )}
                    {item.addresses && (
                      <Text
                        className="mt-1 text-[11px] text-gray-600"
                        numberOfLines={1}
                      >
                        {item.addresses.formatted_address ||
                          `${item.addresses.neighborhood ?? ""} ${
                            item.addresses.street ?? ""
                          } No:${item.addresses.building_no ?? ""} ${
                            item.addresses.district ?? ""
                          }/${item.addresses.city ?? ""}`}
                      </Text>
                    )}
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full border ${getStatusColors(
                      item.status,
                    )}`}
                  >
                    <Text className="text-[11px] font-semibold">
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                {item.note && (
                  <Text className="mt-2 text-xs text-gray-600" numberOfLines={2}>
                    Not: {item.note}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            ListFooterComponent={
              activeOrders.length > 0
                ? () => (
                    <View className="mt-2">
                      <Text className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                        Sık Kullanılanlar
                      </Text>
                      <View className="flex-row gap-3">
                        <TouchableOpacity
                          onPress={() => router.push("/(customer)/addresses")}
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
                              Son Kullanılan Adres
                            </Text>
                          </View>
                          <Text
                            className="text-[11px] text-gray-600"
                            numberOfLines={2}
                          >
                            {activeOrders[0]?.addresses?.formatted_address ||
                              `${activeOrders[0]?.addresses?.neighborhood ?? ""} ${
                                activeOrders[0]?.addresses?.street ?? ""
                              } No:${activeOrders[0]?.addresses?.building_no ?? ""} ${
                                activeOrders[0]?.addresses?.district ?? ""
                              }/${activeOrders[0]?.addresses?.city ?? ""}`}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => router.push("/(customer)/pharmacies")}
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
                              Son Eczane
                            </Text>
                          </View>
                          <Text
                            className="text-[11px] text-gray-600"
                            numberOfLines={2}
                          >
                            {activeOrders[0]?.pharmacies?.name || "Eczane adı yok"}
                            {activeOrders[0]?.pharmacies?.district &&
                              activeOrders[0]?.pharmacies?.city && (
                                <Text className="text-[11px] text-gray-500">
                                  {` - ${activeOrders[0].pharmacies?.district}/${activeOrders[0].pharmacies?.city}`}
                                </Text>
                              )}
                          </Text>
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

      {/* Aktif sipariş detay modalı */}
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="fade"
        onRequestClose={closeOrderModal}
      >
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View className="bg-white rounded-2xl p-5 max-h-[85%]">
            {selectedOrder && (
              <ScrollView>
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1 mr-3">
                    <Text className="text-xs font-semibold text-gray-500 uppercase">
                      Sipariş Detayı
                    </Text>
                    <Text className="mt-1 text-lg font-semibold text-gray-900">
                      Reçete No:{" "}
                      <Text className="font-mono">
                        {selectedOrder.prescription_no || "-"}
                      </Text>
                    </Text>
                    <Text className="mt-1 text-xs text-gray-500">
                      {new Date(selectedOrder.created_at).toLocaleString("tr-TR")}
                    </Text>
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full border ${getStatusColors(
                      selectedOrder.status,
                    )}`}
                  >
                    <Text className="text-xs font-semibold">
                      {getStatusLabel(selectedOrder.status)}
                    </Text>
                  </View>
                </View>

                <View className="border-t border-gray-200 pt-3 mt-1">
                  <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Eczane
                  </Text>
                  {selectedOrder.pharmacies ? (
                    <Text className="text-sm text-gray-900">
                      {selectedOrder.pharmacies.name}
                      {selectedOrder.pharmacies.district &&
                        selectedOrder.pharmacies.city && (
                          <Text className="text-sm text-gray-600">
                            {` - ${selectedOrder.pharmacies.district}/${selectedOrder.pharmacies.city}`}
                          </Text>
                        )}
                    </Text>
                  ) : (
                    <Text className="text-sm text-gray-500">
                      Eczane bilgisi bulunamadı.
                    </Text>
                  )}
                </View>

                <View className="border-t border-gray-200 pt-3 mt-3">
                  <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Teslimat Adresi
                  </Text>
                  {selectedOrder.addresses ? (
                    <Text className="text-sm text-gray-800">
                      {selectedOrder.addresses.formatted_address ||
                        `${selectedOrder.addresses.neighborhood ?? ""} ${
                          selectedOrder.addresses.street ?? ""
                        } No:${selectedOrder.addresses.building_no ?? ""} ${
                          selectedOrder.addresses.district ?? ""
                        }/${selectedOrder.addresses.city ?? ""}`}
                    </Text>
                  ) : (
                    <Text className="text-sm text-gray-500">
                      Adres bilgisi bulunamadı.
                    </Text>
                  )}
                </View>

                <View className="border-t border-gray-200 pt-3 mt-3">
                  <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Not
                  </Text>
                  <Text className="text-sm text-gray-800">
                    {selectedOrder.note
                      ? selectedOrder.note
                      : "Herhangi bir not eklenmemiş."}
                  </Text>
                </View>

                {selectedOrder.prescription_image_path && (
                  <View className="border-t border-gray-200 pt-3 mt-3">
                    <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Reçete Fotoğrafı
                    </Text>
                    {prescriptionImageUrl ? (
                      <View className="mt-1 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden max-h-72 items-center justify-center">
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
                            const { data } = await supabase.auth.getSession();
                            const token = data.session?.access_token;
                            if (!token) {
                              Alert.alert(
                                "Hata",
                                "Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın.",
                              );
                              return;
                            }
                            const baseUrl =
                              process.env.EXPO_PUBLIC_WEB_BASE_URL ??
                              "http://localhost:3000";
                            const url = `${baseUrl}/api/prescription-image?orderId=${selectedOrder.id}&token=${encodeURIComponent(
                              token,
                            )}`;
                            setPrescriptionImageUrl(url);
                          } catch (e) {
                            const msg =
                              e instanceof Error ? e.message : String(e);
                            Alert.alert(
                              "Hata",
                              `Reçete fotoğrafı açılırken bir sorun oluştu.\n\nDetay: ${msg}`,
                            );
                          } finally {
                            setLoadingPrescriptionImage(false);
                          }
                        }}
                        disabled={loadingPrescriptionImage}
                        className="self-start mt-1 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2"
                      >
                        <Text className="text-xs font-semibold text-emerald-700">
                          {loadingPrescriptionImage
                            ? "Yükleniyor..."
                            : "Reçete fotoğrafını görüntüle"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View className="flex-row justify-end mt-5">
                  <TouchableOpacity
                    onPress={closeOrderModal}
                    className="px-4 py-2 rounded-lg bg-gray-900"
                  >
                    <Text className="text-white text-sm font-semibold">
                      Kapat
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
