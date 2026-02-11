import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode as atob } from "base-64";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  latitude: number | null;
  longitude: number | null;
};

type PharmacyRow = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function OrderByBarcode() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [prescriptionNo, setPrescriptionNo] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prescriptionImageUri, setPrescriptionImageUri] = useState<string | null>(
    null,
  );
  const [pickingImage, setPickingImage] = useState(false);

  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null
  );
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  const [pharmacies, setPharmacies] = useState<PharmacyRow[]>([]);
  const [pharmacyModalOpen, setPharmacyModalOpen] = useState(false);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(
    null,
  );
  const [pharmacyManuallyChosen, setPharmacyManuallyChosen] = useState(false);

  const normalizePrescriptionNo = (value: string) => value.trim().toUpperCase();

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId) || null,
    [addresses, selectedAddressId]
  );

  const selectedPharmacy = useMemo(
    () => pharmacies.find((p) => p.id === selectedPharmacyId) || null,
    [pharmacies, selectedPharmacyId],
  );

  const addressTitle = (a: AddressRow) => {
    if (a.title === "Diğer" && a.custom_title) return a.custom_title;
    return a.title;
  };

  const addressesQuery = useQuery<AddressRow[], Error>({
    queryKey: ["customer-addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) {
        throw new Error("Kullanıcı oturumu bulunamadı.");
      }

      const { data, error } = await (supabase as any)
        .from("addresses")
        .select(
          "id,title,custom_title,neighborhood,district,city,street,building_no,formatted_address,is_default,latitude,longitude",
        )
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        // Hem query'yi fail et hem kullanıcıya mesaj göster
        Alert.alert(
          "Hata",
          error.message || "Adresler yüklenemedi.",
        );
        throw new Error(error.message);
      }

      return (data || []) as AddressRow[];
    },
  });

  const addressesData: AddressRow[] = useMemo(
    () => (addressesQuery.data ?? []) as AddressRow[],
    [addressesQuery.data],
  );
  const addressesLoading = addressesQuery.isLoading;

  useEffect(() => {
    setAddresses(addressesData);
    if (addressesData.length > 0 && !selectedAddressId) {
      const defaultOne =
        addressesData.find((x: AddressRow) => x.is_default) ||
        addressesData[0] ||
        null;
      setSelectedAddressId(defaultOne?.id || null);
    }
  }, [addressesData, selectedAddressId]);

  const pharmaciesQuery = useQuery<PharmacyRow[], Error>({
    queryKey: ["pharmacies"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pharmacies")
        .select("id,name,city,district,latitude,longitude")
        .order("name", { ascending: true });

      if (error) {
        Alert.alert(
          "Hata",
          error.message || "Eczaneler yüklenemedi.",
        );
        throw new Error(error.message);
      }

      return (data || []) as PharmacyRow[];
    },
  });

  const pharmaciesData: PharmacyRow[] = useMemo(
    () => (pharmaciesQuery.data ?? []) as PharmacyRow[],
    [pharmaciesQuery.data],
  );
  const pharmaciesLoading = pharmaciesQuery.isLoading;

  useEffect(() => {
    setPharmacies(pharmaciesData);
    if (!selectedPharmacyId) {
      setPharmacyManuallyChosen(false);
    }
  }, [pharmaciesData, selectedPharmacyId]);

  const toRad = (value: number) => (value * Math.PI) / 180;

  const distanceInKm = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    [],
  );

  const sortedPharmacies = useMemo(() => {
    if (
      !selectedAddress ||
      selectedAddress.latitude == null ||
      selectedAddress.longitude == null
    ) {
      return pharmacies.map((p) => ({ pharmacy: p, distanceKm: null }));
    }

    return pharmacies
      .map((p) => {
        if (p.latitude == null || p.longitude == null) {
          return { pharmacy: p, distanceKm: null };
        }

        const d = distanceInKm(
          selectedAddress.latitude as number,
          selectedAddress.longitude as number,
          p.latitude as number,
          p.longitude as number,
        );

        return { pharmacy: p, distanceKm: d };
      })
      .sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }, [pharmacies, selectedAddress, distanceInKm]);

  useEffect(() => {
    if (
      !selectedAddress ||
      selectedAddress.latitude == null ||
      selectedAddress.longitude == null
    ) {
      return;
    }

    if (sortedPharmacies.length === 0) return;
    if (pharmacyManuallyChosen) return;

    // Adres konumu biliniyorsa ve kullanıcı özel bir seçim yapmadıysa
    // en yakın eczaneyi otomatik olarak seç
    setSelectedPharmacyId(sortedPharmacies[0].pharmacy.id);
  }, [sortedPharmacies, selectedAddress, pharmacyManuallyChosen]);

  const formatDistance = (km: number | null) => {
    if (km == null) return "";
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  };

  const handlePickImage = async () => {
    try {
      setPickingImage(true);

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "İzin gerekli",
          "Reçete fotoğrafı eklemek için galeri erişim izni vermelisiniz.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        Alert.alert("Hata", "Seçilen görüntü işlenemedi.");
        return;
      }

      setPrescriptionImageUri(asset.uri);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Bir hata oluştu.";
      Alert.alert("Hata", msg);
    } finally {
      setPickingImage(false);
    }
  };

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Kullanıcı oturumu bulunamadı.");
      }

      const pn = normalizePrescriptionNo(prescriptionNo);
      if (!pn && !prescriptionImageUri) {
        throw new Error(
          "Reçete numarası veya reçete fotoğrafından en az birini girmelisiniz.",
        );
      }

      if (!selectedAddressId) {
        throw new Error(
          "Sipariş verebilmek için bir teslimat adresi seçmelisiniz.",
        );
      }

      if (!selectedPharmacyId) {
        throw new Error("Sipariş verebilmek için bir eczane seçmelisiniz.");
      }

      let prescriptionImagePath: string | null = null;

      if (prescriptionImageUri) {
        const extMatch = prescriptionImageUri.split(".").pop();
        const fileExt =
          (extMatch && extMatch.split("?")[0].toLowerCase()) || "jpg";
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const filePath = `prescriptions/${fileName}`;

        // RN/Expo'da en stabil yol: dosyayı base64 oku -> byte array olarak upload et
        const base64 = await FileSystem.readAsStringAsync(
          prescriptionImageUri,
          {
            encoding: "base64",
          } as any,
        );

        const bytes = atob(base64);
        const byteNumbers = new Array<number>(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          byteNumbers[i] = bytes.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        const { error: uploadError } = (await (supabase as any).storage
          .from("prescriptions")
          .upload(filePath, byteArray, {
            contentType: `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
            upsert: false,
          })) as any;

        if (uploadError) {
          throw new Error(
            uploadError.message ||
              "Reçete fotoğrafı yüklenirken bir hata oluştu.",
          );
        }

        prescriptionImagePath = filePath;
      }

      const { error: orderError } = (await (supabase as any)
        .from("orders")
        .insert({
          user_id: user.id,
          address_id: selectedAddressId,
          prescription_no: pn || null,
          status: "pending",
          note: note.trim() || null,
          pharmacy_id: selectedPharmacyId,
          prescription_image_path: prescriptionImagePath,
        })) as any;

      if (orderError) throw orderError;
    },
    onMutate: () => {
      setSubmitting(true);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu";
      Alert.alert("Hata", msg);
      setSubmitting(false);
    },
    onSuccess: () => {
      setPrescriptionNo("");
      setNote("");
      setPrescriptionImageUri(null);
      void queryClient.invalidateQueries({ queryKey: ["customer-orders"] });

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

      setSubmitting(false);
    },
  });

  const handlePlaceOrder = () => {
    placeOrderMutation.mutate();
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
              <Text className="text-emerald-600 text-base">← Geri</Text>
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
            <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-medium text-gray-700">
                    Teslimat Adresi
                  </Text>
                  {selectedAddress?.is_default && (
                    <View className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                      <Text className="text-[10px] font-semibold text-emerald-700">
                        Varsayılan
                      </Text>
                    </View>
                  )}
                </View>
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
                <View className="bg-gray-50 border border-gray-100 rounded-xl p-3">
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

            {/* Eczane seçimi */}
            <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-gray-700">
                  Eczane
                </Text>
                <TouchableOpacity
                  onPress={() => setPharmacyModalOpen(true)}
                  disabled={pharmaciesLoading || pharmacies.length === 0}
                >
                  <Text className="text-emerald-600 font-semibold">
                    {selectedPharmacy ? "Değiştir" : "Seç"}
                  </Text>
                </TouchableOpacity>
              </View>

              {pharmaciesLoading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#059669" className="mr-2" />
                  <Text className="text-gray-600">Eczaneler yükleniyor...</Text>
                </View>
              ) : pharmacies.length === 0 ? (
                <View>
                  <Text className="text-gray-600 text-sm">
                    Kayıtlı eczane bulunamadı. Eczaneler eklendikçe burada
                    listelenecek.
                  </Text>
                </View>
              ) : (
                <View className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <Text className="text-gray-900 font-semibold">
                    {selectedPharmacy
                      ? selectedPharmacy.name
                      : "En yakın eczane seçilecek"}
                  </Text>
                  {selectedPharmacy && (
                    <Text className="text-gray-600 text-sm mt-1">
                      {selectedPharmacy.district && selectedPharmacy.city
                        ? `${selectedPharmacy.district}/${selectedPharmacy.city}`
                        : selectedPharmacy.city ||
                          selectedPharmacy.district ||
                          ""}
                    </Text>
                  )}
                  {selectedPharmacy && selectedAddress && (
                    <Text className="text-gray-500 text-xs mt-1">
                      {(() => {
                        if (
                          selectedAddress.latitude == null ||
                          selectedAddress.longitude == null ||
                          selectedPharmacy.latitude == null ||
                          selectedPharmacy.longitude == null
                        ) {
                          return "";
                        }
                        const km = distanceInKm(
                          selectedAddress.latitude,
                          selectedAddress.longitude,
                          selectedPharmacy.latitude,
                          selectedPharmacy.longitude,
                        );
                        return `Uzaklık: ${formatDistance(km)}`;
                      })()}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Reçete Numarası
              </Text>
              <TextInput
                className="border border-emerald-200 rounded-xl px-4 py-3 text-base"
                style={{ backgroundColor: "rgba(236, 253, 245, 0.4)" }}
                placeholder="Örn: 2G1OL81"
                value={prescriptionNo}
                onChangeText={setPrescriptionNo}
                autoCapitalize="characters"
                returnKeyType="done"
                blurOnSubmit
              />
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Not (opsiyonel)
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                placeholder="Örn: Muadil kabul ediyorum / etmiyorum..."
                value={note}
                onChangeText={setNote}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-gray-700">
                  Reçete Fotoğrafı (opsiyonel)
                </Text>
                {prescriptionImageUri && (
                  <TouchableOpacity
                    onPress={() => setPrescriptionImageUri(null)}
                    disabled={submitting}
                  >
                    <Text className="text-xs text-red-600 font-semibold">
                      Kaldır
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {prescriptionImageUri ? (
                <View className="flex-row items-center">
                  <Image
                    source={{ uri: prescriptionImageUri }}
                    style={{ width: 72, height: 72, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    onPress={handlePickImage}
                    disabled={pickingImage || submitting}
                    className="ml-4 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50"
                  >
                    <Text className="text-xs font-semibold text-gray-800">
                      Değiştir
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={pickingImage || submitting}
                  className="border border-dashed border-emerald-300 rounded-xl py-3 px-4 flex-row items-center justify-center bg-emerald-50/40"
                >
                  <Text className="text-sm text-emerald-700 font-medium">
                    {pickingImage
                      ? "Galeri açılıyor..."
                      : "Reçete fotoğrafı ekle"}
                  </Text>
                </TouchableOpacity>
              )}
              <Text className="text-[11px] text-gray-500 mt-2">
                Fotoğraf eklemek zorunlu değildir, fakat eczanenin reçetenizi
                daha hızlı kontrol etmesine yardımcı olur.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handlePlaceOrder}
              disabled={
                submitting ||
                (!normalizePrescriptionNo(prescriptionNo) &&
                  !prescriptionImageUri) ||
                !selectedAddressId ||
                !selectedPharmacyId
              }
              className={`bg-emerald-600 rounded-xl py-4 ${
                submitting ||
                (!normalizePrescriptionNo(prescriptionNo) &&
                  !prescriptionImageUri) ||
                !selectedPharmacyId
                  ? "opacity-50"
                  : ""
              }`}
            >
              {submitting ? (
                <View className="flex-row items-center justify-center">
                  <ActivityIndicator color="#ECFDF5" className="mr-2" />
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
        <TouchableWithoutFeedback onPress={() => setAddressModalOpen(false)}>
          <View className="flex-1 justify-end">
            <TouchableWithoutFeedback onPress={() => {}}>
              <View className="bg-white rounded-t-3xl p-6 max-h-[75%]">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-lg font-bold text-gray-900">
                    Adres Seç
                  </Text>
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
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Eczane seçme modal */}
      <Modal
        visible={pharmacyModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPharmacyModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPharmacyModalOpen(false)}>
          <View className="flex-1 justify-end">
            <TouchableWithoutFeedback onPress={() => {}}>
              <View className="bg-white rounded-t-3xl p-6 max-h-[75%]">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-lg font-bold text-gray-900">
                    Eczane Seç
                  </Text>
                  <TouchableOpacity onPress={() => setPharmacyModalOpen(false)}>
                    <Text className="text-blue-600 font-semibold">Kapat</Text>
                  </TouchableOpacity>
                </View>

                {pharmaciesLoading ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#2563eb" className="mr-2" />
                    <Text className="text-gray-600">
                      Eczaneler yükleniyor...
                    </Text>
                  </View>
                ) : pharmacies.length === 0 ? (
                  <Text className="text-gray-600 text-sm">
                    Henüz kayıtlı eczane bulunmuyor. Eczaneler eklendikçe burada
                    listelenecek.
                  </Text>
                ) : (
                  <FlatList
                    data={sortedPharmacies}
                    keyExtractor={(item) => item.pharmacy.id}
                    renderItem={({ item }) => {
                      const { pharmacy, distanceKm } = item;
                      const selected = pharmacy.id === selectedPharmacyId;
                      const distanceText = formatDistance(distanceKm);

                      return (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedPharmacyId(pharmacy.id);
                            setPharmacyManuallyChosen(true);
                            setPharmacyModalOpen(false);
                          }}
                          className={`border rounded-xl p-4 mb-3 ${
                            selected
                              ? "border-emerald-600 bg-emerald-50"
                              : "border-gray-200"
                          }`}
                        >
                          <View className="flex-row justify-between items-center">
                            <View className="flex-1 mr-2">
                              <Text className="text-gray-900 font-semibold">
                                {pharmacy.name}
                              </Text>
                              <Text className="text-gray-600 text-sm mt-1">
                                {pharmacy.district && pharmacy.city
                                  ? `${pharmacy.district}/${pharmacy.city}`
                                  : pharmacy.city || pharmacy.district || ""}
                              </Text>
                            </View>
                            {distanceText ? (
                              <Text className="text-xs font-semibold text-emerald-700">
                                {distanceText}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}
