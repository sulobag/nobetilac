import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Callout,
  type Region,
} from "react-native-maps";
import { useQuery } from "@tanstack/react-query";

const LOCATION_PIN = require("@/assets/images/location-pin.png");

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

export default function PharmaciesMap() {
  const router = useRouter();
  const {
    data: pharmacies = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["pharmacies-map"],
    queryFn: async () => {
      const { data, error: err } = await (supabase as any)
        .from("pharmacies")
        .select(
          "id,name,phone,city,district,neighborhood,street,building_no,latitude,longitude",
        )
        .order("name", { ascending: true });

      if (err) {
        throw new Error(err.message);
      }

      return (data || []) as PharmacyRow[];
    },
  });

  const markers = useMemo(
    () =>
      pharmacies
        .filter(
          (p) =>
            typeof p.latitude === "number" && typeof p.longitude === "number"
        )
        .map((p) => ({
          id: p.id,
          latitude: p.latitude as number,
          longitude: p.longitude as number,
          title: p.name,
          description:
            (p.neighborhood || "") +
            " " +
            (p.street || "") +
            " No:" +
            (p.building_no || "") +
            " " +
            (p.district || "") +
            "/" +
            (p.city || ""),
        })),
    [pharmacies]
  );

  const initialRegion: Region = useMemo(() => {
    if (markers.length > 0) {
      const first = markers[0];
      return {
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    // İstanbul fallback
    return {
      latitude: 41.0082,
      longitude: 28.9784,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }, [markers]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-600 mt-4">Eczaneler yükleniyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-6 bg-gray-50">
        <Text className="text-red-600 text-sm text-center mb-4">
          Eczaneler yüklenirken bir hata oluştu:{" "}
          {error instanceof Error ? error.message : String(error)}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-blue-600 rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (markers.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6 bg-gray-50">
        <Text className="text-xl font-bold text-gray-900 mb-2">
          Haritada gösterilecek eczane yok
        </Text>
        <Text className="text-gray-600 text-center mb-4">
          Eczaneler eklendikçe burada harita üzerinde görebileceksiniz.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-blue-600 rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{
              latitude: m.latitude,
              longitude: m.longitude,
            }}
            anchor={{ x: 0.5, y: 1 }}
            image={LOCATION_PIN}
          >
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{m.title}</Text>
                <Text style={styles.calloutText}>{m.description}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View className="absolute top-12 left-4 right-4 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-white rounded-full px-4 py-2"
        >
          <Text className="text-blue-600 font-semibold">← Geri</Text>
        </TouchableOpacity>
        <View className="bg-white rounded-full px-4 py-2">
          <Text className="text-gray-800 font-semibold">Eczaneler Harita</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calloutContainer: {
    maxWidth: 260,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 13,
    color: "#4b5563",
  },
});
