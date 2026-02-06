import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import MapViewComponent, {
  type MapViewComponentRef,
} from "@/components/MapView";
import LocationSearch from "@/components/LocationSearch";
import {
  requestLocationPermission,
  reverseGeocode,
  formatAddress,
} from "@/utils/locationHelpers";
import type { Region } from "react-native-maps";

export default function SelectLocation() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<MapViewComponentRef>(null);

  const [region, setRegion] = useState<Region>({
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const debounceTimer = useRef<number | null>(null);

  useEffect(() => {
    getCurrentUserLocation();
  }, []);

  const getCurrentUserLocation = async () => {
    setLoading(true);
    const result = await requestLocationPermission();

    if (result.granted && result.location) {
      const newRegion = {
        latitude: result.location.coords.latitude,
        longitude: result.location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);

      // Haritayı bu konuma animasyonla götür
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }

      await fetchAddressForRegion(newRegion);
    }
    setLoading(false);
  };

  // Debounced reverse geocoding
  const fetchAddressForRegion = async (currentRegion: Region) => {
    // İptal et önceki timer'ı
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setFetchingAddress(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        const address = await reverseGeocode(
          currentRegion.latitude,
          currentRegion.longitude
        );

        if (address) {
          const addressText = [
            address.street,
            address.district,
            address.city,
            address.region,
          ]
            .filter(Boolean)
            .join(", ");
          setSelectedAddress(addressText || "Adres bulunamadı");
        } else {
          setSelectedAddress("Adres bulunamadı");
        }
      } catch (error) {
        console.error("Adres alınamadı:", error);
        setSelectedAddress("Adres alınamadı");
      } finally {
        setFetchingAddress(false);
      }
    }, 800) as unknown as number; // 800ms bekle
  };

  const handleRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
    // Her hareket için adres getir (debounced)
    fetchAddressForRegion(newRegion);
  };

  const handleSearchLocation = useCallback(
    (location: { latitude: number; longitude: number; address: string }) => {
      const newRegion = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);

      // Haritayı arama sonucuna animasyonla götür
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }

      setSelectedAddress(location.address);
      setFetchingAddress(false); // Arama sonucu geldiğinde loading kapat
      Keyboard.dismiss();
    },
    []
  );

  const handleSelectLocation = async () => {
    setLoading(true);

    const address = await reverseGeocode(region.latitude, region.longitude);

    if (!address) {
      Alert.alert("Hata", "Bu konum için adres bilgisi alınamadı");
      setLoading(false);
      return;
    }

    const formattedAddress = formatAddress(address);

    // Bu ekranı direkt add-address ile değiştir (stack'te çift ekran olmasın)
    router.replace({
      pathname: "/(customer)/add-address",
      params: {
        ...params,
        city: formattedAddress.city,
        district: formattedAddress.district,
        neighborhood: formattedAddress.neighborhood,
        street: formattedAddress.street,
        buildingNo: formattedAddress.buildingNo,
        latitude: region.latitude.toString(),
        longitude: region.longitude.toString(),
      },
    });

    setLoading(false);
  };

  return (
    <View className="flex-1">
      <MapViewComponent
        ref={mapRef}
        initialRegion={region}
        onRegionChange={handleRegionChange}
        centerMarker={true}
        showsUserLocation={true}
      />

      {/* Arama Çubuğu */}
      <View className="absolute top-16 left-4 right-20">
        <LocationSearch
          onSelectLocation={handleSearchLocation}
          placeholder="Adres ara..."
        />
      </View>

      {/* Konum Butonu */}
      <View className="absolute top-16 right-4">
        <TouchableOpacity
          onPress={getCurrentUserLocation}
          disabled={loading}
          className="bg-white rounded-full p-3"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <Ionicons name="locate-outline" size={22} color="#2563eb" />
          )}
        </TouchableOpacity>
      </View>

      {/* Adres Bilgisi Card */}
      <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6">
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-2">
            Seçili Konum
          </Text>
          {fetchingAddress ? (
            <View className="flex-row items-center">
              <ActivityIndicator
                size="small"
                color="#2563eb"
                className="mr-2"
              />
              <Text className="text-gray-600">Adres getiriliyor...</Text>
            </View>
          ) : (
            <Text className="text-gray-700 text-base">
              {selectedAddress || "Haritayı hareket ettirerek adres seçin"}
            </Text>
          )}
        </View>

        {/* Koordinatlar */}
        <View className="mb-4 bg-gray-50 rounded-lg p-3 flex-row items-center">
          <Ionicons
            name="location-outline"
            size={14}
            color="#6B7280"
            style={{ marginRight: 4 }}
          />
          <Text className="text-xs text-gray-500">
            {region.latitude.toFixed(6)}, {region.longitude.toFixed(6)}
          </Text>
        </View>

        {/* Butonlar */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-1 bg-gray-200 rounded-xl py-4"
          >
            <Text className="text-gray-800 text-center text-base font-semibold">
              İptal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSelectLocation}
            disabled={loading || fetchingAddress || !selectedAddress}
            className={`flex-1 bg-emerald-600 rounded-xl py-4 ${
              loading || fetchingAddress || !selectedAddress ? "opacity-50" : ""
            }`}
          >
            <Text className="text-white text-center text-base font-semibold">
              Bu Konumu Seç
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
