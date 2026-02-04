import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type AddressRow = {
  id: string;
  title: string;
  custom_title: string | null;
  neighborhood: string;
  district: string;
  city: string;
  street: string;
  building_no: string;
  formatted_address: string | null;
  is_default: boolean;
};

export default function OrderByBarcode() {
  const router = useRouter();
  const { user } = useAuth();

  const [prescriptionNo, setPrescriptionNo] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  const normalizePrescriptionNo = (value: string) => value.trim().toUpperCase();

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId) || null,
    [addresses, selectedAddressId],
  );

  const addressTitle = (a: AddressRow) => {
    if (a.title === "Diğer" && a.custom_title) return a.custom_title;
    return a.title;
  };

  const fetchAddresses = async () => {
    if (!user) return;
    setAddressesLoading(true);

    const { data, error } = await (supabase as any)
      .from("addresses")
      .select(
        "id,title,custom_title,neighborhood,district,city,street,building_no,formatted_address,is_default",
      )
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Hata", "Adresler yüklenemedi: " + error.message);
      setAddresses([]);
      setSelectedAddressId(null);
    } else {
      const rows = (data || []) as AddressRow[];
      setAddresses(rows);

      // Varsayılan adresi otomatik seç
      const defaultOne = rows.find((x) => x.is_default) || rows[0] || null;
      setSelectedAddressId(defaultOne?.id || null);
    }

    setAddressesLoading(false);
  };

  useEffect(() => {
    fetchAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handlePlaceOrder = async () => {
    if (!user) {
      Alert.alert("Hata", "Kullanıcı oturumu bulunamadı");
      return;
    }

    const pn = normalizePrescriptionNo(prescriptionNo);
    if (!pn) {
      Alert.alert("Hata", "Lütfen reçete numarasını girin");
      return;
    }

    if (!selectedAddressId) {
      Alert.alert(
        "Adres Gerekli",
        "Sipariş verebilmek için bir teslimat adresi seçmelisiniz.",
        [
          {
            text: "Adres Ekle",
            onPress: () =>
              router.push({
                pathname: "/(customer)/add-address",
                params: { firstAddress: "false" },
              }),
          },
          { text: "İptal", style: "cancel" },
        ],
      );
      return;
    }

    setSubmitting(true);

    try {
      const { error: orderError } = (await (supabase as any)
        .from("orders")
        .insert({
          user_id: user.id,
          address_id: selectedAddressId,
          prescription_no: pn,
          status: "pending",
          note: note.trim() || null,
        })) as any;

      if (orderError) throw orderError;

      setPrescriptionNo("");
      setNote("");

      Alert.alert("Başarılı", "Siparişiniz alındı!", [
        {
          text: "Siparişlerim",
          onPress: () => router.replace("/(customer)/orders"),
        },
        {
          text: "Tamam",
          style: "cancel",
          onPress: () => router.replace("/(customer)/home"),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu";
      Alert.alert("Hata", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View className="flex-1 bg-gray-50">
          <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-6">
            <TouchableOpacity onPress={() => router.back()} className="mb-2">
              <Text className="text-blue-600 text-base">← Geri</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-900">
              Reçete No ile Sipariş
            </Text>
            <Text className="text-gray-600 text-sm mt-1">
              Reçete numarası girerek sipariş oluşturun
            </Text>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 24, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Adres seçimi */}
            <View className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-gray-700">
                  Teslimat Adresi
                </Text>
                <TouchableOpacity
                  onPress={() => setAddressModalOpen(true)}
                  disabled={addressesLoading || addresses.length === 0}
                >
                  <Text className="text-blue-600 font-semibold">
                    {selectedAddress ? "Değiştir" : "Seç"}
                  </Text>
                </TouchableOpacity>
              </View>

              {addressesLoading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#2563eb" className="mr-2" />
                  <Text className="text-gray-600">Adresler yükleniyor...</Text>
                </View>
              ) : addresses.length === 0 ? (
                <View>
                  <Text className="text-gray-600">
                    Kayıtlı adresiniz yok. Sipariş için önce adres ekleyin.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(customer)/add-address")}
                    className="mt-3 bg-blue-600 rounded-xl py-3"
                  >
                    <Text className="text-white text-center font-semibold">
                      Adres Ekle
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <Text className="text-gray-900 font-semibold">
                    {selectedAddress
                      ? addressTitle(selectedAddress)
                      : "Adres seçin"}
                  </Text>
                  {selectedAddress && (
                    <Text className="text-gray-600 text-sm mt-1">
                      {selectedAddress.formatted_address
                        ? selectedAddress.formatted_address
                        : `${selectedAddress.neighborhood}, ${selectedAddress.street} No:${selectedAddress.building_no} - ${selectedAddress.district}/${selectedAddress.city}`}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Reçete Numarası
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                placeholder="Örn: 2G1OL81"
                value={prescriptionNo}
                onChangeText={setPrescriptionNo}
                autoCapitalize="characters"
                returnKeyType="done"
                blurOnSubmit
              />
            </View>

            <View className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Not (opsiyonel)
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                placeholder="Örn: Muadil kabul ediyorum / etmiyorum..."
                value={note}
                onChangeText={setNote}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              onPress={handlePlaceOrder}
              disabled={
                submitting ||
                !normalizePrescriptionNo(prescriptionNo) ||
                !selectedAddressId
              }
              className={`bg-blue-600 rounded-xl py-4 ${
                submitting || !normalizePrescriptionNo(prescriptionNo)
                  ? "opacity-50"
                  : ""
              }`}
            >
              {submitting ? (
                <View className="flex-row items-center justify-center">
                  <ActivityIndicator color="white" className="mr-2" />
                  <Text className="text-white text-lg font-semibold">
                    Gönderiliyor...
                  </Text>
                </View>
              ) : (
                <Text className="text-white text-center text-lg font-semibold">
                  Siparişi Ver
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* Adres seçme modal */}
      <Modal
        visible={addressModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddressModalOpen(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[75%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-900">Adres Seç</Text>
              <TouchableOpacity onPress={() => setAddressModalOpen(false)}>
                <Text className="text-blue-600 font-semibold">Kapat</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={addresses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const selected = item.id === selectedAddressId;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedAddressId(item.id);
                      setAddressModalOpen(false);
                    }}
                    className={`border rounded-xl p-4 mb-3 ${
                      selected
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200"
                    }`}
                  >
                    <View className="flex-row justify-between items-center">
                      <Text className="text-gray-900 font-semibold">
                        {addressTitle(item)}
                      </Text>
                      {item.is_default && (
                        <View className="bg-green-100 rounded-full px-3 py-1">
                          <Text className="text-xs font-semibold text-green-700">
                            Varsayılan
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-gray-600 text-sm mt-2">
                      {item.formatted_address
                        ? item.formatted_address
                        : `${item.neighborhood}, ${item.street} No:${item.building_no} - ${item.district}/${item.city}`}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              onPress={() => {
                setAddressModalOpen(false);
                router.push("/(customer)/addresses");
              }}
              className="bg-gray-100 rounded-xl py-3 mt-2"
            >
              <Text className="text-gray-800 text-center font-semibold">
                Adreslerimi Yönet
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
