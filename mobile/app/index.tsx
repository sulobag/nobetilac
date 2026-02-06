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
      <View className="flex-1 items-center justify-center bg-gray-50">
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
    <View className="flex-1 bg-gray-50 px-6 justify-center">
      {/* Logo / Başlık */}
      <View className="mb-10 items-center">
        <Text className="text-xs font-semibold text-emerald-600 uppercase mb-1">
          Nöbet İlaç
        </Text>
        <Text className="text-4xl font-bold text-gray-900 text-center mb-2">
          {showPanelSelection
            ? `Hoş geldiniz, ${profile?.full_name}`
            : "Gece ilaç hizmeti"}
        </Text>
        <Text className="text-sm text-gray-600 text-center">
          Reçetelerinizi kolayca yönetmek için giriş yapın.
        </Text>
      </View>

      {showPanelSelection ? (
        // Kullanıcı hem customer hem courier - panel seçimi göster
        <View className="w-full max-w-sm self-center bg-white rounded-2xl px-4 py-6 border border-gray-100">
          <Text className="text-center text-gray-700 mb-4 text-sm">
            Hangi paneli kullanmak istersiniz?
          </Text>

          <TouchableOpacity
            onPress={() => router.replace("/(customer)/home")}
            className="bg-emerald-600 rounded-xl py-3 px-6 mb-3"
          >
            <Text className="text-white text-center text-base font-semibold">
              Müşteri Paneli
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/(courier)/home")}
            className="bg-green-600 rounded-xl py-3 px-6"
          >
            <Text className="text-white text-center text-base font-semibold">
              Kurye Paneli
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Normal welcome ekranı
        <View className="w-full max-w-sm self-center">
          {/* Kullanıcı Butonları */}
          <View className="mb-8 bg-white rounded-2xl px-4 py-6 border border-gray-100">
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Müşteri
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/customer/login")}
              className="bg-emerald-600 rounded-xl py-3 px-6 mb-3"
            >
              <Text className="text-white text-center text-base font-semibold">
                Kullanıcı Girişi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/customer/register")}
              className="bg-white border-2 border-emerald-600 rounded-xl py-3 px-6"
            >
              <Text className="text-emerald-600 text-center text-base font-semibold">
                Kullanıcı Kayıt
              </Text>
            </TouchableOpacity>
          </View>

          {/* Kurye Butonları */}
          <View className="bg-white rounded-2xl px-4 py-6 border border-gray-100">
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Kurye
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/courier/login")}
              className="bg-green-600 rounded-xl py-3 px-6 mb-3"
            >
              <Text className="text-white text-center text-base font-semibold">
                Kurye Girişi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/courier/register")}
              className="bg-white border-2 border-green-600 rounded-xl py-3 px-6"
            >
              <Text className="text-green-600 text-center text-base font-semibold">
                Kurye Kayıt
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
