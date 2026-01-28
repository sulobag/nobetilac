import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function CustomerHome() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    Alert.alert("Çıkış Yap", "Çıkış yapmak istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-white p-6">
      {/* Header */}
      <View className="mt-12 mb-8">
        <Text className="text-3xl font-bold text-gray-900">
          Merhaba, {profile?.full_name}
        </Text>
        <Text className="text-gray-600 mt-2">
          Nöbet İlaç&apos;a hoş geldiniz
        </Text>
      </View>

      {/* Quick Actions */}
      <View className="space-y-4">
        <TouchableOpacity
          onPress={() => router.push("/(customer)/addresses")}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4"
        >
          <Text className="text-lg font-semibold text-blue-900">
            📍 Adreslerim
          </Text>
          <Text className="text-sm text-gray-600 mt-1">
            Teslimat adreslerinizi görüntüleyin ve düzenleyin
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Alert.alert("Yakında", "Bu özellik yakında eklenecek!");
          }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-4"
        >
          <Text className="text-lg font-semibold text-gray-900">
            💊 Sipariş Ver
          </Text>
          <Text className="text-sm text-gray-600 mt-1">
            Reçete yükleyerek ilaç siparişi verin
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Alert.alert("Yakında", "Bu özellik yakında eklenecek!");
          }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-4"
        >
          <Text className="text-lg font-semibold text-gray-900">
            📦 Siparişlerim
          </Text>
          <Text className="text-sm text-gray-600 mt-1">
            Geçmiş ve aktif siparişlerinizi görüntüleyin
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-red-50 border border-red-200 rounded-xl p-4 mt-8"
        >
          <Text className="text-lg font-semibold text-red-900 text-center">
            Çıkış Yap
          </Text>
        </TouchableOpacity>
      </View>

      {/* Debug Info (Geliştirme için) */}
      <View className="mt-8 bg-gray-50 rounded-lg p-4">
        <Text className="text-xs text-gray-500">Email: {user?.email}</Text>
        <Text className="text-xs text-gray-500">
          Role: {profile?.role?.join(", ") || "N/A"}
        </Text>
      </View>
    </View>
  );
}
