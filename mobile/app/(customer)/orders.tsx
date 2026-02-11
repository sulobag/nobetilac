import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

type OrderRow = {
  id: string;
  status: string;
  prescription_no: string;
  created_at: string;
  note?: string | null;
   prescription_image_path?: string | null;
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
};

export default function Orders() {
  const router = useRouter();
  const { user } = useAuth();

  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [prescriptionImageUrl, setPrescriptionImageUrl] = useState<string | null>(null);
  const [loadingPrescriptionImage, setLoadingPrescriptionImage] = useState(false);

  const {
    data: orders = [],
    isLoading,
    refetch,
  }: UseQueryResult<OrderRow[], Error> = useQuery<OrderRow[], Error>({
    queryKey: ["customer-orders", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<OrderRow[]> => {
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
        .order("created_at", { ascending: false });

      if (error) {
        Alert.alert("Hata", error.message || "Siparişler yüklenemedi.");
        throw new Error(error.message);
      }

      return (data || []) as OrderRow[];
    },
  });

  React.useEffect(() => {
    if (!user) return;

    const channel = (supabase as any)
      .channel(`orders_changes_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refetch();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, refetch]);

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

  const renderItem = ({ item }: { item: OrderRow }) => (
    <TouchableOpacity
      onPress={() => setSelectedOrder(item)}
      activeOpacity={0.85}
      className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm"
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-3">
          <Text className="text-xs font-semibold text-gray-500 uppercase">
            Reçete No
          </Text>
          <Text className="mt-1 text-base font-semibold text-gray-900 font-mono">
            {item.prescription_no}
          </Text>
          <Text className="text-gray-500 text-[11px] mt-1">
            {new Date(item.created_at).toLocaleString("tr-TR")}
          </Text>
        </View>
        <View
          className={`px-3 py-1 rounded-full border ${getStatusColors(
            item.status,
          )}`}
        >
          <Text className="text-xs font-semibold">
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      {item.note && (
        <Text className="mt-2 text-xs text-gray-600 italic" numberOfLines={2}>
          Not: {item.note}
        </Text>
      )}
      {item.prescription_image_path && (
        <Text className="mt-1 text-[11px] text-emerald-700">
          Reçete fotoğrafı eklendi
        </Text>
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="text-gray-600 mt-4">Siparişler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-6">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-emerald-600 text-base">← Geri</Text>
        </TouchableOpacity>
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Siparişlerim
            </Text>
            <Text className="text-gray-600 text-sm mt-1">
              {orders.length} sipariş
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(customer)/order-by-barcode")}
            className="bg-emerald-600 rounded-lg px-4 py-2"
          >
            <Text className="text-white font-semibold">+ Yeni</Text>
          </TouchableOpacity>
        </View>
      </View>

      {orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="cube-outline" size={56} color="#047857" />
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Henüz siparişiniz yok
          </Text>
          <Text className="text-gray-600 text-center mb-6">
            Reçete numarası girerek ilk siparişinizi oluşturabilirsiniz.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(customer)/order-by-barcode")}
            className="bg-emerald-600 rounded-xl px-6 py-3"
          >
            <Text className="text-white font-semibold text-lg">
              İlk Siparişi Oluştur
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshing={isLoading}
          onRefresh={refetch}
        />
      )}

      {/* Sipariş detay modalı */}
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelectedOrder(null);
          setPrescriptionImageUrl(null);
          setLoadingPrescriptionImage(false);
        }}
      >
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View className="bg-white rounded-2xl p-5 max-h-[80%]">
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
                        {selectedOrder.prescription_no}
                      </Text>
                    </Text>
                    <Text className="mt-1 text-xs text-gray-500">
                      {new Date(
                        selectedOrder.created_at,
                      ).toLocaleString("tr-TR")}
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
                        } No:${
                          selectedOrder.addresses.building_no ?? ""
                        } ${selectedOrder.addresses.district ?? ""}/${
                          selectedOrder.addresses.city ?? ""
                        }`}
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

                <TouchableOpacity
                  onPress={() => {
                    setSelectedOrder(null);
                    setPrescriptionImageUrl(null);
                    setLoadingPrescriptionImage(false);
                  }}
                  className="mt-5 self-end px-4 py-2 rounded-lg bg-gray-900"
                >
                  <Text className="text-white text-sm font-semibold">
                    Kapat
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
