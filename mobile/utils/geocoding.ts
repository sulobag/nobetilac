/**
 * Geocoding Utilities
 * Adres bilgilerinden koordinat (latitude/longitude) hesaplama
 */

interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
}

interface AddressComponents {
  city: string;
  district: string;
  neighborhood: string;
  street: string;
  building_no: string;
}

// Google Maps API Response Types
interface GoogleMapsGeocodeResponse {
  status: string;
  results: Array<{
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

// Nominatim API Response Types
interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Google Geocoding API kullanarak adres -> koordinat dönüşümü
 * NOT: Production'da Google API Key gerekir
 */
export async function geocodeAddress(
  components: AddressComponents,
): Promise<GeocodingResult | null> {
  try {
    // Tam adresi oluştur
    const fullAddress = `${components.street} No:${components.building_no}, ${components.neighborhood}, ${components.district}, ${components.city}, Türkiye`;

    // Google Geocoding API
    // NOT: .env dosyasına EXPO_PUBLIC_GOOGLE_MAPS_API_KEY eklenecek
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.warn("Google Maps API Key bulunamadı. Geocoding atlanıyor.");
      return null;
    }

    const encodedAddress = encodeURIComponent(fullAddress);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as GoogleMapsGeocodeResponse;

    if (data.status === "OK" && data.results.length > 0) {
      const result = data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formatted_address: result.formatted_address,
      };
    }

    console.warn("Geocoding sonuç bulunamadı:", data.status);
    return null;
  } catch (error) {
    console.error("Geocoding hatası:", error);
    return null;
  }
}

/**
 * Nominatim (OpenStreetMap) kullanarak ücretsiz geocoding
 * Google API olmadan da çalışır
 */
export async function geocodeAddressWithNominatim(
  components: AddressComponents,
): Promise<GeocodingResult | null> {
  try {
    // Tam adresi oluştur
    const fullAddress = `${components.street} ${components.building_no}, ${components.neighborhood}, ${components.district}, ${components.city}, Turkey`;

    const encodedAddress = encodeURIComponent(fullAddress);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "NobetIlac/1.0", // Nominatim requires User-Agent
      },
    });

    const data = (await response.json()) as NominatimResult[];

    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formatted_address: data[0].display_name,
      };
    }

    console.warn("Nominatim: Sonuç bulunamadı");
    return null;
  } catch (error) {
    console.error("Nominatim geocoding hatası:", error);
    return null;
  }
}

/**
 * Akıllı geocoding - önce Google, yoksa Nominatim kullan
 */
export async function smartGeocode(
  components: AddressComponents,
): Promise<GeocodingResult | null> {
  // Önce Google'ı dene
  let result = await geocodeAddress(components);

  // Google yoksa veya başarısızsa, Nominatim kullan
  if (!result) {
    result = await geocodeAddressWithNominatim(components);
  }

  return result;
}

/**
 * İki koordinat arasındaki mesafeyi hesapla (km)
 * Haversine formülü kullanılır
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Dünya'nın yarıçapı (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
