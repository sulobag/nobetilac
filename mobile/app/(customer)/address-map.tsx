import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import MapViewComponent from "@/components/MapView";
import type { Region } from "react-native-maps";

export default function AddressMap() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const latitude = parseFloat(String(params.latitude));
  const longitude = parseFloat(String(params.longitude));
  const addressTitle = String(params.title);
  const addressDetails = String(params.details);

  const [region] = useState<Region>({
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  return (
    <View className="flex-1">
      <MapViewComponent
        initialRegion={region}
        markers={[
          {
            id: "address",
            latitude,
            longitude,
            title: addressTitle,
            description: addressDetails,
          },
        ]}
        showsUserLocation={false}
      />

      {/* Adres Detay Card */}
      <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6">
        <View className="mb-4">
          <Text className="text-xl font-bold text-gray-900 mb-2">
            {addressTitle}
          </Text>
          <Text className="text-gray-700 text-base">{addressDetails}</Text>
        </View>

        {/* Koordinatlar */}
        <View className="mb-4 bg-gray-50 rounded-lg p-3">
          <Text className="text-xs text-gray-500">
            📌 {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Text>
        </View>

        {/* Kapat Butonu */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-blue-600 rounded-xl py-4"
        >
          <Text className="text-white text-center text-base font-semibold">
            Kapat
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
