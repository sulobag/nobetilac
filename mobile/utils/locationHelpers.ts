import * as Location from "expo-location";
import { Alert } from "react-native";

export interface LocationPermissionResult {
  granted: boolean;
  location?: Location.LocationObject;
}

export async function requestLocationPermission(): Promise<LocationPermissionResult> {
  try {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== "granted") {
      Alert.alert(
        "Konum İzni Gerekli",
        "Adres seçebilmek için konum izni vermeniz gerekiyor.",
      );
      return { granted: false };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      granted: true,
      location,
    };
  } catch (error) {
    console.error("Konum izni hatası:", error);
    Alert.alert("Hata", "Konum bilgisi alınamadı");
    return { granted: false };
  }
}

export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status !== "granted") {
      const result = await requestLocationPermission();
      return result.location || null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return location;
  } catch (error) {
    console.error("Konum alınamadı:", error);
    return null;
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<Location.LocationGeocodedAddress | null> {
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (addresses.length > 0) {
      return addresses[0];
    }

    return null;
  } catch (error) {
    console.error("Reverse geocoding hatası:", error);
    return null;
  }
}

export function formatAddress(address: Location.LocationGeocodedAddress): {
  city: string;
  district: string;
  neighborhood: string;
  street: string;
  buildingNo: string;
} {
  return {
    city: address.city || address.region || "İstanbul",
    district: address.district || address.subregion || "",
    neighborhood: address.street || "",
    street: address.name || "",
    buildingNo: address.streetNumber || "",
  };
}
