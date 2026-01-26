import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export default function Index() {
  const router = useRouter();
  const { session, loading, profile, hasAddress } = useAuth();

  useEffect(() => {
    if (session && !loading && profile) {
      // Rol'e göre yönlendirme (artık role array)
      if (profile.role.includes('customer')) {
        // Customer role'ü varsa adres kontrolü yap
        if (hasAddress === null) {
          // Adres kontrolü henüz yapılmadı, bekle
          return;
        }
        if (hasAddress) {
          router.replace("/(customer)/home");
        } else {
          router.replace({
            pathname: "/(customer)/add-address",
            params: { firstAddress: "true" }
          });
        }
      } else if (profile.role.includes('courier')) {
        router.replace("/(customer)/home");
      }
    }
  }, [session, loading, profile, hasAddress, router]);

  if (loading || (session && hasAddress === null)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg text-gray-600">Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      {/* Logo / Başlık */}
      <View className="mb-16">
        <Text className="text-5xl font-bold text-blue-600 text-center mb-3">
          Nöbet İlaç
        </Text>
        <Text className="text-base text-gray-600 text-center">
          Gece ilaç ihtiyacınız için
        </Text>
      </View>

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
    </View>
  );
}
