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
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        {/* Header */}
        <View className="mt-12 mb-8">
          {!isFirstAddress && (
            <TouchableOpacity onPress={() => router.back()} className="mb-4">
              <Text className="text-blue-600 text-base">← Geri</Text>
            </TouchableOpacity>
          )}
          <Text className="text-3xl font-bold text-gray-900">
            {isFirstAddress ? "Adres Ekle" : "Yeni Adres"}
          </Text>
          <Text className="text-gray-600 mt-2">
            {isFirstAddress
              ? "Devam etmek için bir adres ekleyin"
              : "Teslimat adresi bilgilerini girin"}
          </Text>
        </View>

        {/* Harita Butonu */}
        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: "/(customer)/select-location",
              params: {
                // İlk adres akışını kaybetmemek için parametreyi taşı
                ...(isFirstAddress ? { firstAddress: "true" } : {}),
                from: "add-address",
              },
            })
          }
          className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 mb-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center flex-1">
            <Ionicons
              name="map-outline"
              size={26}
              color="#1D4ED8"
              style={{ marginRight: 12 }}
            />
            <View className="flex-1">
              <Text className="text-blue-700 font-semibold text-base">
                Haritadan Adres Seç
              </Text>
              <Text className="text-blue-600 text-sm mt-1">
                {latitude && longitude
                  ? "✓ Konum seçildi"
                  : "Haritada konumunuzu işaretleyin"}
              </Text>
            </View>
          </View>
          <Text className="text-blue-600 text-xl">→</Text>
        </TouchableOpacity>

        {/* Form */}
        <View className="space-y-4">
          {/* Adres Başlığı */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Adres Başlığı *
            </Text>
            <View className="flex-row gap-2">
              {titleOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setTitle(option)}
                  className={`px-6 py-3 rounded-lg border-2 ${
                    title === option
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <Text
                    className={`text-base ${
                      title === option
                        ? "text-white font-semibold"
                        : "text-gray-700"
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
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Özel Adres Başlığı *
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                placeholder="Örn: Annemin Evi, Ofis 2, Villa..."
                value={customTitle}
                onChangeText={setCustomTitle}
                autoCapitalize="words"
              />
            </View>
          )}

          {/* Şehir */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Şehir *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="İstanbul"
              value={city}
              onChangeText={setCity}
            />
          </View>

          {/* İlçe */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              İlçe/Semt *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Kadıköy"
              value={district}
              onChangeText={setDistrict}
            />
          </View>

          {/* Mahalle */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Mahalle *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Caferağa Mahallesi"
              value={neighborhood}
              onChangeText={setNeighborhood}
            />
          </View>

          {/* Cadde/Sokak */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Cadde/Sokak *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Moda Caddesi"
              value={street}
              onChangeText={setStreet}
            />
          </View>

          {/* Bina No */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Bina No *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="42"
              value={buildingNo}
              onChangeText={setBuildingNo}
            />
          </View>

          {/* Kat & Daire (Yan yana) */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Kat
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                placeholder="3"
                value={floor}
                onChangeText={setFloor}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Daire No
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                placeholder="5"
                value={apartmentNo}
                onChangeText={setApartmentNo}
              />
            </View>
          </View>

          {/* Adres Tarifi */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Adres Tarifi
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Kırmızı binadan sonra sağdaki siyah kapı..."
              value={addressDescription}
              onChangeText={setAddressDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Varsayılan Adres */}
          <TouchableOpacity
            onPress={() => setIsDefault(!isDefault)}
            className="flex-row items-center py-3"
          >
            <View
              className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${
                isDefault ? "bg-blue-600 border-blue-600" : "border-gray-300"
              }`}
            >
              {isDefault && <Text className="text-white text-sm">✓</Text>}
            </View>
            <Text className="text-base text-gray-700">
              Varsayılan adres olarak kaydet
            </Text>
          </TouchableOpacity>

          {/* Kaydet Butonu */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            className={`bg-blue-600 rounded-xl py-4 mt-6 ${
              loading ? "opacity-50" : ""
            }`}
          >
            {loading ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator color="white" className="mr-2" />
                <Text className="text-white text-center text-lg font-semibold">
                  {geocoding ? "Konum hesaplanıyor..." : "Kaydediliyor..."}
                </Text>
              </View>
            ) : (
              <Text className="text-white text-center text-lg font-semibold">
                Adresi Kaydet
              </Text>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Text className="text-sm text-gray-700">
              💡 <Text className="font-semibold">Bilgi:</Text> Konum bilgisi
              otomatik olarak hesaplanacaktır. Bu işlem birkaç saniye sürebilir.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
