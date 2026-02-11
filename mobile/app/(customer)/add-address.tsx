import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { smartGeocode } from "@/utils/geocoding";

export default function AddAddress() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, checkUserAddresses } = useAuth();

  const isFirstAddress = params.firstAddress === "true";

  const [title, setTitle] = useState<"Ev" | "İş" | "Diğer">("Ev");
  const [customTitle, setCustomTitle] = useState("");
  const [city, setCity] = useState(
    params.city ? String(params.city) : "İstanbul",
  );
  const [district, setDistrict] = useState(
    params.district ? String(params.district) : "",
  );
  const [neighborhood, setNeighborhood] = useState(
    params.neighborhood ? String(params.neighborhood) : "",
  );
  const [street, setStreet] = useState(
    params.street ? String(params.street) : "",
  );
  const [buildingNo, setBuildingNo] = useState(
    params.buildingNo ? String(params.buildingNo) : "",
  );
  const [floor, setFloor] = useState("");
  const [apartmentNo, setApartmentNo] = useState("");
  const [addressDescription, setAddressDescription] = useState("");
  const [isDefault, setIsDefault] = useState(isFirstAddress);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(
    params.latitude ? parseFloat(String(params.latitude)) : null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    params.longitude ? parseFloat(String(params.longitude)) : null,
  );

  const titleOptions: ("Ev" | "İş" | "Diğer")[] = ["Ev", "İş", "Diğer"];

  const handleSave = async () => {
    // Validasyon
    if (
      !title ||
      !city ||
      !district ||
      !neighborhood ||
      !street ||
      !buildingNo
    ) {
      Alert.alert("Hata", "Lütfen zorunlu alanları doldurun");
      return;
    }

    // Diğer seçiliyse özel başlık kontrolü
    if (title === "Diğer" && !customTitle.trim()) {
      Alert.alert("Hata", "Lütfen adres başlığını girin");
      return;
    }

    if (!user) {
      Alert.alert("Hata", "Kullanıcı oturumu bulunamadı");
      return;
    }

    setLoading(true);

    let finalLatitude = latitude;
    let finalLongitude = longitude;
    let formattedAddress = null;

    // Eğer haritadan konum seçilmediyse, geocoding yap
    if (!latitude || !longitude) {
      setGeocoding(true);
      const geocodeResult = await smartGeocode({
        city,
        district,
        neighborhood,
        street,
        building_no: buildingNo,
      });
      setGeocoding(false);

      finalLatitude = geocodeResult?.latitude || null;
      finalLongitude = geocodeResult?.longitude || null;
      formattedAddress = geocodeResult?.formatted_address || null;
    }

    const addressData = {
      user_id: user.id,
      title: title,
      custom_title: title === "Diğer" ? customTitle : null,
      city,
      district,
      neighborhood,
      street,
      building_no: buildingNo,
      floor: floor || null,
      apartment_no: apartmentNo || null,
      address_description: addressDescription || null,
      latitude: finalLatitude,
      longitude: finalLongitude,
      formatted_address: formattedAddress,
      is_default: isDefault,
    };

    const { error } = await supabase
      .from("addresses")
      .insert(addressData as any);

    setLoading(false);

    if (error) {
      Alert.alert("Hata", "Adres kaydedilemedi: " + error.message);
    } else {
      // Auth context içindeki hasAddress bilgisini güncelle
      await checkUserAddresses();

      if (!finalLatitude || !finalLongitude) {
        Alert.alert(
          "Uyarı",
          "Adres kaydedildi ancak konum bilgisi hesaplanamadı. Daha sonra güncellenebilir.",
          [
            {
              text: "Tamam",
              onPress: () => {
                if (isFirstAddress) {
                  // İlk adres akışında direkt ana sayfaya dön
                  router.replace("/(customer)/home");
                } else {
                  // Normal akışta bir önceki ekrana (adresler) geri dön
                  router.back();
                }
              },
            },
          ],
        );
      } else {
        // Başarılı kayıt
        if (isFirstAddress) {
          // İlk adres eklendiyse ana sayfaya yönlendir
          Alert.alert("Başarılı", "Adresiniz kaydedildi!", [
            {
              text: "Tamam",
              onPress: () => router.replace("/(customer)/home"),
            },
          ]);
        } else {
          // Diğer adreslerde bir önceki ekrana (adresler) geri dön
          router.back();
        }
      }
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="pt-12 px-6 pb-6">
        {/* Header */}
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-row items-center">
            {!isFirstAddress && (
              <TouchableOpacity
                onPress={() => router.back()}
                className="mr-3 rounded-full bg-white border border-gray-200 w-9 h-9 items-center justify-center"
              >
                <Ionicons name="chevron-back" size={20} color="#047857" />
              </TouchableOpacity>
            )}
            <View>
              <Text className="text-xs font-semibold text-emerald-600 uppercase">
                Adres
              </Text>
              <Text className="text-2xl font-bold text-gray-900 mt-1">
                {isFirstAddress ? "Adres Ekle" : "Yeni Adres"}
              </Text>
            </View>
          </View>
        </View>

        {/* Ana kart */}
        <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Harita Butonu */}
          <TouchableOpacity
            onPress={() =>
              router.replace({
                pathname: "/(customer)/select-location",
                params: {
                  ...(isFirstAddress ? { firstAddress: "true" } : {}),
                  from: "add-address",
                },
              })
            }
            className="bg-emerald-50 border-b border-emerald-100 px-4 py-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1">
              <View className="w-9 h-9 rounded-full bg-white border border-emerald-100 items-center justify-center mr-3">
                <Ionicons
                  name="map-outline"
                  size={22}
                  color="#047857"
                />
              </View>
              <View className="flex-1">
                <Text className="text-emerald-800 font-semibold text-sm">
                  Haritadan adres seç
                </Text>
                <Text className="text-emerald-700 text-xs mt-1">
                  {latitude && longitude
                    ? "✓ Konum seçildi"
                    : "Haritada konumunuzu işaretleyin"}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#047857" />
          </TouchableOpacity>

          {/* Form */}
          <View className="px-4 py-5 space-y-4">
            {/* Adres Başlığı */}
            <View>
              <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                Adres Başlığı *
              </Text>
              <View className="flex-row gap-2">
                {titleOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setTitle(option)}
                    className={`flex-1 flex-row items-center justify-center px-3 py-2 rounded-full border ${
                      title === option
                        ? "bg-emerald-600 border-emerald-600"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <Ionicons
                      name={
                        option === "Ev"
                          ? "home-outline"
                          : option === "İş"
                            ? "briefcase-outline"
                            : "location-outline"
                      }
                      size={16}
                      color={title === option ? "#ECFDF5" : "#047857"}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        title === option ? "text-emerald-50" : "text-gray-800"
                      }`}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Özel Başlık (Diğer seçiliyse) */}
            {title === "Diğer" && (
              <View>
                <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                  Özel Adres Başlığı *
                </Text>
                <TextInput
                  className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50"
                  placeholder="Örn: Annemin Evi, Ofis 2, Villa..."
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  autoCapitalize="words"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            )}

            {/* Şehir */}
            <View>
              <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                Şehir *
              </Text>
              <TextInput
                className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50"
                placeholder="İstanbul"
                value={city}
                onChangeText={setCity}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* İlçe */}
            <View>
              <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                İlçe/Semt *
              </Text>
              <TextInput
                className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50"
                placeholder="Kadıköy"
                value={district}
                onChangeText={setDistrict}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Mahalle */}
            <View>
              <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                Mahalle *
              </Text>
              <TextInput
                className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50"
                placeholder="Caferağa Mahallesi"
                value={neighborhood}
                onChangeText={setNeighborhood}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Cadde/Sokak */}
            <View>
              <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                Cadde/Sokak *
              </Text>
              <TextInput
                className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50"
                placeholder="Moda Caddesi"
                value={street}
                onChangeText={setStreet}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Bina No */}
            <View>
              <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                Bina No *
              </Text>
              <TextInput
                className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50"
                placeholder="42"
                value={buildingNo}
                onChangeText={setBuildingNo}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Kat & Daire (Yan yana) */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                  Kat
                </Text>
                <TextInput
                  className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50"
                  placeholder="3"
                  value={floor}
                  onChangeText={setFloor}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                  Daire No
                </Text>
                <TextInput
                  className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50"
                  placeholder="5"
                  value={apartmentNo}
                  onChangeText={setApartmentNo}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Adres Tarifi */}
            <View>
              <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                Adres Tarifi
              </Text>
              <TextInput
                className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50"
                placeholder="Kırmızı binadan sonra sağdaki siyah kapı..."
                value={addressDescription}
                onChangeText={setAddressDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Varsayılan Adres */}
            <TouchableOpacity
              onPress={() => setIsDefault(!isDefault)}
              className="flex-row items-center py-2"
            >
              <View
                className={`w-6 h-6 rounded-full mr-3 items-center justify-center border ${
                  isDefault ? "bg-emerald-600 border-emerald-600" : "border-gray-300"
                }`}
              >
                {isDefault && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text className="text-sm text-gray-800">
                Varsayılan adres olarak kaydet
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Kaydet Butonu + Bilgi */}
        <View className="mt-5">
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            className={`bg-emerald-600 rounded-2xl py-4 flex-row items-center justify-center ${
              loading ? "opacity-60" : ""
            }`}
          >
            {loading ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="white" style={{ marginRight: 8 }} />
                <Text className="text-white text-base font-semibold">
                  {geocoding ? "Konum hesaplanıyor..." : "Kaydediliyor..."}
                </Text>
              </View>
            ) : (
              <Text className="text-white text-base font-semibold">
                Adresi Kaydet
              </Text>
            )}
          </TouchableOpacity>

          <View className="mt-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
            <Text className="text-xs text-emerald-900">
              💡 <Text className="font-semibold">Bilgi:</Text> Konum bilgisi
              otomatik olarak hesaplanacaktır. Bu işlem birkaç saniye sürebilir.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
