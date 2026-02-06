import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function CustomerHome() {
  const router = useRouter();
  const { profile } = useAuth();

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header - Liquid Glass */}
      <View className="mt-12 mx-6 mb-6">
        <View style={styles.headerBackground} />
        <View className="rounded-3xl px-5 py-6" style={styles.glassCard}>
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-xs font-semibold text-emerald-100 uppercase">
                Nöbet İlaç
              </Text>
              <Text className="text-2xl font-bold text-white mt-1">
                Merhaba{profile?.full_name ? `, ${profile.full_name}` : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(customer)/profile")}
              className="ml-3"
            >
              <Ionicons
                name="person-circle-outline"
                size={30}
                color="#ECFDF5"
              />
            </TouchableOpacity>
          </View>
          <Text className="text-emerald-100 mt-2 text-sm">
            Reçetenizi girin, en uygun eczaneye yönlendirelim.
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View className="flex-1 px-6">
        <View className="flex-row gap-3 mb-3">
          <TouchableOpacity
            onPress={() => router.push("/(customer)/order-by-barcode")}
            className="flex-1 bg-white rounded-2xl px-4 py-4 border border-emerald-100"
          >
            <Text className="text-xs font-semibold text-emerald-600 uppercase">
              Hızlı İşlem
            </Text>
            <View className="flex-row items-center mt-1">
              <MaterialCommunityIcons
                name="pill"
                size={22}
                color="#047857"
                style={{ marginRight: 6 }}
              />
              <Text className="text-lg font-semibold text-gray-900">
                Reçete ile Sipariş
              </Text>
            </View>
            <Text className="text-xs text-gray-600 mt-1">
              Reçete numarası girerek hemen sipariş verin.
            </Text>
          </TouchableOpacity>
        </View>

        <View className="grid grid-cols-2 gap-3 mb-4">
          <TouchableOpacity
            onPress={() => router.push("/(customer)/addresses")}
            className="bg-white rounded-2xl px-4 py-4 border border-gray-100"
          >
            <Ionicons name="location-outline" size={24} color="#047857" />
            <Text className="text-sm font-semibold text-gray-900">
              Adreslerim
            </Text>
            <Text className="text-xs text-gray-600 mt-1">
              Teslimat adreslerini yönet.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(customer)/pharmacies")}
            className="bg-white rounded-2xl px-4 py-4 border border-gray-100"
          >
            <MaterialCommunityIcons
              name="hospital-building"
              size={24}
              color="#047857"
            />
            <Text className="text-sm font-semibold text-gray-900">
              Eczaneler
            </Text>
            <Text className="text-xs text-gray-600 mt-1">
              Yakındaki eczaneleri gör.
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(customer)/orders")}
          className="bg-white rounded-2xl px-4 py-4 border border-gray-100 mb-4"
        >
          <View className="flex-row items-center mb-1">
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={20}
              color="#047857"
              style={{ marginRight: 6 }}
            />
            <Text className="text-sm font-semibold text-gray-900">
              Siparişlerim
            </Text>
          </View>
          <Text className="text-xs text-gray-600 mt-1">
            Aktif ve geçmiş siparişlerinizi buradan takip edebilirsiniz.
          </Text>
        </TouchableOpacity>

        {/* Çıkış butonu kullanıcı sayfasına taşındı */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBackground: {
    position: "absolute",
    inset: 0,
    borderRadius: 24,
    backgroundColor: "#059669",
  },
  glassCard: {
    backgroundColor: "rgba(15, 118, 110, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(240, 253, 250, 0.7)",
  },
});
