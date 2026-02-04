import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type OrderRow = {
  id: string;
  status: string;
  prescription_no: string;
  created_at: string;
};

export default function Orders() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("orders")
      .select("id,status,prescription_no,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Hata", "Siparişler yüklenemedi: " + error.message);
    } else {
      setOrders((data || []) as OrderRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = (supabase as any)
      .channel(`orders_changes_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          setOrders((current) => {
            const list = [...current];

            if (payload.eventType === "INSERT") {
              const row = payload.new as OrderRow;
              // En üste ekle
              return [row, ...list];
            }

            if (payload.eventType === "UPDATE") {
              const row = payload.new as OrderRow;
              return list.map((o) => (o.id === row.id ? row : o));
            }

            if (payload.eventType === "DELETE") {
              const row = payload.old as OrderRow;
              return list.filter((o) => o.id !== row.id);
            }

            return list;
          });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  const renderItem = ({ item }: { item: OrderRow }) => (
    <View className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-gray-900 font-bold">Sipariş</Text>
        <View className="bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
          <Text className="text-blue-700 text-xs font-semibold">
            {item.status}
          </Text>
        </View>
      </View>

      <Text className="text-gray-600 mt-2">
        Reçete No: {item.prescription_no}
      </Text>
      <Text className="text-gray-500 text-sm mt-1">
        {new Date(item.created_at).toLocaleString("tr-TR")}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-600 mt-4">Siparişler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-6">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-blue-600 text-base">← Geri</Text>
        </TouchableOpacity>
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Siparişlerim
            </Text>
            <Text className="text-gray-600 text-sm mt-1">
              {orders.length} sipariş
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(customer)/order-by-barcode")}
            className="bg-blue-600 rounded-lg px-4 py-2"
          >
            <Text className="text-white font-semibold">+ Yeni</Text>
          </TouchableOpacity>
        </View>
      </View>

      {orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">📦</Text>
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Henüz siparişiniz yok
          </Text>
          <Text className="text-gray-600 text-center mb-6">
            Reçete numarası girerek ilk siparişinizi oluşturabilirsiniz.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(customer)/order-by-barcode")}
            className="bg-blue-600 rounded-xl px-6 py-3"
          >
            <Text className="text-white font-semibold text-lg">
              İlk Siparişi Oluştur
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshing={loading}
          onRefresh={fetchOrders}
        />
      )}
    </View>
  );
}
