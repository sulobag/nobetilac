import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function CustomerProfile() {
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
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-6">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-emerald-600 text-base">← Geri</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">Hesabım</Text>
        <Text className="text-gray-600 text-sm mt-1">
          Kullanıcı bilgilerinizi görüntüleyin ve çıkış yapın.
        </Text>
      </View>

      <View className="flex-1 px-6 pt-4">
        {/* Kullanıcı kartı */}
        <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <View className="w-12 h-12 rounded-full bg-emerald-50 items-center justify-center mr-3">
              <Ionicons name="person-outline" size={24} color="#047857" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">
                {profile?.full_name || "İsim bilgisi yok"}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                {user?.email || "Email bilgisi yok"}
              </Text>
            </View>
          </View>

          {profile?.phone && (
            <View className="mt-2">
              <Text className="text-xs font-semibold text-gray-500">
                Telefon
              </Text>
              <Text className="text-sm text-gray-800 mt-1">
                {profile.phone}
              </Text>
            </View>
          )}

          {profile?.role && (
            <View className="mt-3">
              <Text className="text-xs font-semibold text-gray-500">
                Roller
              </Text>
              <Text className="text-sm text-gray-800 mt-1">
                {Array.isArray(profile.role)
                  ? profile.role.join(", ")
                  : String(profile.role)}
              </Text>
            </View>
          )}
        </View>

        {/* Navigasyon kutuları */}
        <View className="mt-2">
          <TouchableOpacity
            onPress={() => router.push("/(customer)/addresses")}
            className="flex-row items-center bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-3"
          >
            <View className="w-9 h-9 rounded-full bg-emerald-50 items-center justify-center mr-3">
              <Ionicons name="location-outline" size={18} color="#047857" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900">
                Adreslerim
              </Text>
              <Text className="text-xs text-gray-600 mt-1">
                Teslimat adreslerini görüntüleyin ve yönetin.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Çıkış butonu */}
        <TouchableOpacity
          onPress={handleSignOut}
          className="mt-auto mb-6 bg-red-50 border border-red-200 rounded-2xl py-3"
        >
          <Text className="text-sm font-semibold text-red-700 text-center">
            Çıkış Yap
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
