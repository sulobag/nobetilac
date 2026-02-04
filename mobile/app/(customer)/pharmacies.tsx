import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

type PharmacyRow = {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  district: string | null;
  neighborhood: string | null;
  street: string | null;
  building_no: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function Pharmacies() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pharmacies, setPharmacies] = useState<PharmacyRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPharmacies = async () => {
      setLoading(true);
      setError(null);

      const { data, error: err } = await (supabase as any)
        .from("pharmacies")
        .select(
          "id,name,phone,city,district,neighborhood,street,building_no,latitude,longitude",
        )
        .order("name", { ascending: true });

      if (err) {
        setError(err.message);
        setPharmacies([]);
      } else {
        setPharmacies((data || []) as PharmacyRow[]);
      }

      setLoading(false);
    };

    fetchPharmacies();
  }, []);

  const renderPharmacyItem = ({ item }: { item: PharmacyRow }) => {
    const address = [
      item.neighborhood,
      item.street && `${item.street} No:${item.building_no ?? ""}`,
      item.district && `${item.district}/${item.city ?? ""}`,
    ]
      .filter(Boolean)
      .join(" - ");

    return (
      <View className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
        <Text className="text-lg font-semibold text-gray-900">{item.name}</Text>
        {item.phone && (
          <Text className="text-sm text-gray-700 mt-1">{item.phone}</Text>
        )}
        {address.length > 0 && (
          <Text className="text-sm text-gray-600 mt-1">{address}</Text>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 px-6 pt-12 pb-3">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-blue-600 text-base">← Geri</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">Eczaneler</Text>
        <Text className="text-gray-600 text-sm mt-1">
          Yakındaki eczaneleri liste halinde görüntüleyin veya haritada görün.
        </Text>

        <TouchableOpacity
          onPress={() => router.push("/(customer)/pharmacies-map")}
          className="mt-3 self-start bg-blue-50 border border-blue-200 rounded-full px-4 py-2"
        >
          <Text className="text-blue-700 text-sm font-semibold">
            🗺️ Haritada Gör
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-gray-600 mt-4">Eczaneler yükleniyor...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-red-600 text-sm text-center">
            Eczaneler yüklenirken bir hata oluştu: {error}
          </Text>
        </View>
      ) : pharmacies.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Henüz kayıtlı eczane yok
          </Text>
          <Text className="text-gray-600 text-center">
            Eczaneler eklendikçe burada listelenecek.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pharmacies}
          keyExtractor={(item) => item.id}
          renderItem={renderPharmacyItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}
