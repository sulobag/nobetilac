import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

export default function Index() {
  const router = useRouter();
  const { session, loading, profile, hasAddress } = useAuth();
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Sadece bir kere yönlendir (uygulama ilk açıldığında)
    if (hasNavigated.current) return;

    if (session && !loading && profile) {
      const isCourier = profile.role.includes("courier");
      const isCustomer = profile.role.includes("customer");

      // Sadece tek rol varsa otomatik yönlendir
      if (isCourier && !isCustomer) {
        // Sadece kurye
        hasNavigated.current = true;
        router.replace("/(courier)/home");
      } else if (isCustomer && !isCourier) {
        // Sadece müşteri - adres kontrolü yap
        if (hasAddress === null) return; // Adres kontrolü henüz yapılmadı

        hasNavigated.current = true;
        if (hasAddress) {
          router.replace("/(customer)/home");
        } else {
          router.replace({
            pathname: "/(customer)/add-address",
            params: { firstAddress: "true" },
          });
        }
      }
      // Her iki rol de varsa welcome ekranını göster, kullanıcı seçsin
    }
  }, [session, loading, profile, hasAddress, router]);

  if (
    loading ||
    (session &&
      profile &&
      hasAddress === null &&
      profile.role.includes("customer"))
  ) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg text-gray-600">Yükleniyor...</Text>
      </View>
    );
  }

  // Session var ve her iki rol de varsa panel seçimi göster
  const showPanelSelection =
    session &&
    profile &&
    profile.role.includes("customer") &&
    profile.role.includes("courier");

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      {/* Logo / Başlık */}
      <View className="mb-16">
        <Text className="text-5xl font-bold text-blue-600 text-center mb-3">
          Nöbet İlaç
        </Text>
        <Text className="text-base text-gray-600 text-center">
          {showPanelSelection
            ? `Hoş geldiniz, ${profile?.full_name}`
            : "Gece ilaç ihtiyacınız için"}
        </Text>
      </View>

      {showPanelSelection ? (
        // Kullanıcı hem customer hem courier - panel seçimi göster
        <View className="w-full max-w-sm">
          <Text className="text-center text-gray-700 mb-6 text-base">
            Hangi paneli kullanmak istersiniz?
          </Text>

          <TouchableOpacity
            onPress={() => router.replace("/(customer)/home")}
            className="bg-blue-600 rounded-xl py-4 px-6 shadow-sm mb-4"
          >
            <Text className="text-white text-center text-lg font-semibold">
              Müşteri Paneli
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/(courier)/home")}
            className="bg-green-600 rounded-xl py-4 px-6 shadow-sm"
          >
            <Text className="text-white text-center text-lg font-semibold">
              Kurye Paneli
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Normal welcome ekranı
        <>
          {/* Kullanıcı Butonları */}
          <View className="w-full max-w-sm mb-8">
            <TouchableOpacity
              onPress={() => router.push("/(auth)/customer/login")}
              className="bg-blue-600 rounded-xl py-4 px-6 shadow-sm mb-4"
            >
              <Text className="text-white text-center text-lg font-semibold">
                Kullanıcı Girişi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/customer/register")}
              className="bg-white border-2 border-blue-600 rounded-xl py-4 px-6"
            >
              <Text className="text-blue-600 text-center text-lg font-semibold">
                Kullanıcı Kayıt
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ayırıcı */}
          <View className="w-full max-w-sm mb-8">
            <View className="flex-row items-center">
              <View className="flex-1 h-px bg-gray-300" />
              <Text className="mx-4 text-gray-500 text-sm">Kurye misiniz?</Text>
              <View className="flex-1 h-px bg-gray-300" />
            </View>
          </View>

          {/* Kurye Butonları */}
          <View className="w-full max-w-sm">
            <TouchableOpacity
              onPress={() => router.push("/(auth)/courier/login")}
              className="bg-green-600 rounded-xl py-4 px-6 shadow-sm mb-4"
            >
              <Text className="text-white text-center text-lg font-semibold">
                Kurye Girişi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/courier/register")}
              className="bg-white border-2 border-green-600 rounded-xl py-4 px-6"
            >
              <Text className="text-green-600 text-center text-lg font-semibold">
                Kurye Kayıt
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
