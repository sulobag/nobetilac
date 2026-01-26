import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Database } from "@/types/database.types";

type Address = Database["public"]["Tables"]["addresses"]["Row"];

export default function Addresses() {
  const router = useRouter();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAddresses = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Hata", "Adresler yüklenemedi: " + error.message);
    } else {
      setAddresses(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAddresses();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAddresses();
  };

  const handleDelete = (address: Address) => {
    Alert.alert(
      "Adresi Sil",
      "Bu adresi silmek istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("addresses")
              .delete()
              .eq("id", address.id);

            if (error) {
              Alert.alert("Hata", "Adres silinemedi: " + error.message);
            } else {
              fetchAddresses();
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (address: Address) => {
    const { error } = await supabase
      .from("addresses")
      // @ts-ignore - Supabase type inference issue
      .update({ is_default: true })
      .eq("id", address.id);

    if (error) {
      Alert.alert("Hata", "Varsayılan adres güncellenemedi: " + error.message);
    } else {
      fetchAddresses();
    }
  };

  const renderAddress = ({ item }: { item: Address }) => (
    <View className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
      {/* Başlık ve Varsayılan Badge */}
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center">
          <Text className="text-lg font-bold text-gray-900">{item.title}</Text>
          {item.is_default && (
            <View className="bg-blue-100 rounded-full px-3 py-1 ml-2">
              <Text className="text-xs font-semibold text-blue-700">
                Varsayılan
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Adres Detayları */}
      <Text className="text-gray-700 mb-1">
        {item.street} No:{item.building_no}
        {item.floor && `, Kat: ${item.floor}`}
        {item.apartment_no && `, Daire: ${item.apartment_no}`}
      </Text>
      
      {/* Formatted Address (geocoding'den gelen) */}
      {item.formatted_address ? (
        <Text className="text-gray-600 text-sm mb-3 leading-5">
          {item.formatted_address}
        </Text>
      ) : (
        <>
          <Text className="text-gray-600 text-sm mb-2">
            {item.street} {item.building_no}
            {item.floor && `, Kat: ${item.floor}`}
            {item.apartment_no && `, Daire: ${item.apartment_no}`}
          </Text>
          <Text className="text-gray-600 text-sm mb-3">
            {item.neighborhood}, {item.district}, {item.city}
          </Text>
        </>
      )}

      {item.address_description && (
        <Text className="text-gray-500 text-sm italic mb-3">
          &quot;{item.address_description}&quot;
        </Text>
      )}

      {/* Aksiyonlar */}
      <View className="flex-row gap-2 mt-2">
        {!item.is_default && (
          <TouchableOpacity
            onPress={() => handleSetDefault(item)}
            className="flex-1 bg-blue-50 border border-blue-200 rounded-lg py-2"
          >
            <Text className="text-blue-700 text-center text-sm font-semibold">
              Varsayılan Yap
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          className="bg-red-50 border border-red-200 rounded-lg py-2 px-4"
        >
          <Text className="text-red-700 text-center text-sm font-semibold">
            Sil
          </Text>
        </TouchableOpacity>
      </View>

      {/* Konum Bilgisi (Debug) */}
      {item.latitude && item.longitude && (
        <Text className="text-xs text-gray-400 mt-2">
          📍 {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
        </Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-600 mt-4">Adresler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-6">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-blue-600 text-base">← Geri</Text>
        </TouchableOpacity>
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Adreslerim
            </Text>
            <Text className="text-gray-600 text-sm mt-1">
              {addresses.length} adres kayıtlı
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(customer)/add-address")}
            className="bg-blue-600 rounded-lg px-4 py-2"
          >
            <Text className="text-white font-semibold">+ Yeni</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Adres Listesi */}
      {addresses.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">📍</Text>
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Henüz adres eklemediniz
          </Text>
          <Text className="text-gray-600 text-center mb-6">
            Sipariş verebilmek için en az bir teslimat adresi eklemelisiniz
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(customer)/add-address")}
            className="bg-blue-600 rounded-xl px-6 py-3"
          >
            <Text className="text-white font-semibold text-lg">
              İlk Adresi Ekle
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          renderItem={renderAddress}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}
