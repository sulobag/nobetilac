import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

export default function CourierHome() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);

  const handleSignOut = async () => {
    Alert.alert("Çıkış Yap", "Çıkış yapmak istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  const toggleAvailability = () => {
    setIsAvailable(!isAvailable);
    Alert.alert(
      isAvailable ? "Çevrimdışı" : "Çevrimiçi",
      isAvailable
        ? "Artık sipariş almayacaksınız."
        : "Artık sipariş alabilirsiniz.",
    );
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-green-600 px-6 pt-12 pb-6">
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-white text-2xl font-bold">Kurye Paneli</Text>
            <Text className="text-green-100 mt-1">
              Hoş geldiniz, {profile?.full_name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-white/20 px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-semibold">Çıkış</Text>
          </TouchableOpacity>
        </View>

        {/* Durum Toggle */}
        <View className="bg-white rounded-xl p-4">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-gray-900 text-lg font-semibold">
                Müsaitlik Durumu
              </Text>
              <Text className="text-gray-600 text-sm mt-1">
                {isAvailable
                  ? "Çevrimiçi - Sipariş alabilirsiniz"
                  : "Çevrimdışı"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={toggleAvailability}
              className={`w-16 h-8 rounded-full ${
                isAvailable ? "bg-green-600" : "bg-gray-300"
              } justify-center px-1`}
            >
              <View
                className={`w-6 h-6 rounded-full bg-white ${
                  isAvailable ? "self-end" : "self-start"
                }`}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* İstatistikler */}
      <View className="px-6 mt-6">
        <Text className="text-lg font-bold text-gray-900 mb-4">
          Bugünün Özeti
        </Text>
        <View className="flex-row justify-between space-x-3">
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-600 text-sm">Teslim Edilen</Text>
            <Text className="text-2xl font-bold text-gray-900 mt-1">0</Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-600 text-sm">Kazanç</Text>
            <Text className="text-2xl font-bold text-green-600 mt-1">₺0</Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-600 text-sm">Mesafe</Text>
            <Text className="text-2xl font-bold text-gray-900 mt-1">0 km</Text>
          </View>
        </View>
      </View>

      {/* Aktif Siparişler */}
      <View className="px-6 mt-6">
        <Text className="text-lg font-bold text-gray-900 mb-4">
          Aktif Siparişler
        </Text>
        <View className="bg-white rounded-xl p-6 items-center">
          <Text className="text-gray-600 text-center">
            Şu anda aktif siparişiniz bulunmuyor
          </Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Çevrimiçi olduğunuzda yeni siparişler burada görünecek
          </Text>
        </View>
      </View>

      {/* Hızlı Erişim Kartları */}
      <View className="px-6 mt-6 mb-8">
        <Text className="text-lg font-bold text-gray-900 mb-4">
          Hızlı Erişim
        </Text>
        <View className="space-y-3">
          <TouchableOpacity className="bg-white rounded-xl p-4 flex-row items-center shadow-sm">
            <View className="bg-green-100 w-12 h-12 rounded-full items-center justify-center">
              <Text className="text-2xl">📜</Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-gray-900 font-semibold text-base">
                Sipariş Geçmişi
              </Text>
              <Text className="text-gray-600 text-sm">
                Tüm teslimatlarınızı görüntüleyin
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="bg-white rounded-xl p-4 flex-row items-center shadow-sm">
            <View className="bg-blue-100 w-12 h-12 rounded-full items-center justify-center">
              <Text className="text-2xl">💰</Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-gray-900 font-semibold text-base">
                Kazançlarım
              </Text>
              <Text className="text-gray-600 text-sm">
                Gelir detaylarını inceleyin
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="bg-white rounded-xl p-4 flex-row items-center shadow-sm">
            <View className="bg-purple-100 w-12 h-12 rounded-full items-center justify-center">
              <Text className="text-2xl">⚙️</Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-gray-900 font-semibold text-base">
                Ayarlar
              </Text>
              <Text className="text-gray-600 text-sm">
                Hesap ve araç bilgileriniz
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
