import { useState } from "react";
import * as Location from "expo-location";

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface UseLocationReturn {
  location: LocationCoords | null;
  address: string | null;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<void>;
  getAddressFromCoords: (coords: LocationCoords) => Promise<string | null>;
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Konum izni verilmedi");
        return false;
      }
      return true;
    } catch (err) {
      console.error("Permission error:", err);
      setError("Konum izni alınırken hata oluştu");
      return false;
    }
  };

  const getCurrentLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setLocation(coords);

      // Adresi al
      const addressText = await getAddressFromCoords(coords);
      setAddress(addressText);
    } catch (err) {
      setError("Konum alınırken hata oluştu");
      console.error("Location error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getAddressFromCoords = async (
    coords: LocationCoords,
  ): Promise<string | null> => {
    try {
      const [result] = await Location.reverseGeocodeAsync(coords);
      if (result) {
        const parts = [
          result.street,
          result.district,
          result.city,
          result.country,
        ].filter(Boolean);
        return parts.join(", ");
      }
      return null;
    } catch (err) {
      console.error("Reverse geocode error:", err);
      return null;
    }
  };

  return {
    location,
    address,
    loading,
    error,
    requestPermission,
    getCurrentLocation,
    getAddressFromCoords,
  };
}
