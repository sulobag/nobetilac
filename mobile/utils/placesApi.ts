import { GOOGLE_MAPS_API_KEY } from "@/lib/constants";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  latitude: number;
  longitude: number;
  formatted_address: string;
}

interface PlacesAutocompleteResponse {
  status: string;
  error_message?: string;
  predictions?: PlacePrediction[];
}

interface PlaceDetailsResponse {
  status: string;
  result?: {
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
    formatted_address?: string;
  };
}

/**
 * Google Places Autocomplete API'yi çağırır
 * @param input Arama sorgusu
 * @returns Adres önerileri
 */
export async function searchPlaces(input: string): Promise<PlacePrediction[]> {
  if (!input || input.length < 3) {
    return [];
  }

  try {
    // Session token ekleyerek API maliyetini azalt
    const sessionToken = Date.now().toString();

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input,
    )}&key=${GOOGLE_MAPS_API_KEY}&language=tr&components=country:tr&sessiontoken=${sessionToken}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = (await response.json()) as PlacesAutocompleteResponse;

    if (data.status === "REQUEST_DENIED") {
      throw new Error(
        data.error_message ||
          "API erişimi reddedildi. Lütfen API key'i kontrol edin.",
      );
    }

    if (data.status === "ZERO_RESULTS") {
      return [];
    }

    if (data.status === "OK" && data.predictions) {
      return data.predictions;
    }

    return [];
  } catch (error) {
    console.error("searchPlaces error:", error);
    throw error;
  }
}

/**
 * Place ID'ye göre detaylı konum bilgisi alır
 * @param placeId Google Place ID
 * @returns Konum detayları (lat, lng, adres)
 */
export async function getPlaceDetails(
  placeId: string,
): Promise<PlaceDetails | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}&language=tr&fields=geometry,formatted_address`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = (await response.json()) as PlaceDetailsResponse;

    if (data.status === "OK" && data.result?.geometry?.location) {
      const { lat, lng } = data.result.geometry.location;
      return {
        latitude: lat,
        longitude: lng,
        formatted_address: data.result.formatted_address || "",
      };
    }

    return null;
  } catch (error) {
    console.error("getPlaceDetails error:", error);
    throw error;
  }
}
