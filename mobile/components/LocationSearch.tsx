import React, { useState, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  searchPlaces as searchPlacesApi,
  getPlaceDetails,
} from "@/utils/placesApi";

interface LocationSearchProps {
  onSelectLocation: (location: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  placeholder?: string;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export default function LocationSearch({
  onSelectLocation,
  placeholder = "Adres ara...",
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<number | null>(null);

  const handleTextChange = (text: string) => {
    setQuery(text);

    if (text.length < 3) {
      setPredictions([]);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);

      try {
        const results = await searchPlacesApi(text);

        if (results && results.length > 0) {
          setPredictions(results);
        } else {
          setPredictions([]);
        }
      } catch (error: unknown) {
        console.error("Adres arama hatası:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";

        if (errorMessage.includes("API")) {
          Alert.alert(
            "API Hatası",
            "Adres arama servisi şu anda kullanılamıyor. Lütfen manuel olarak adres girin."
          );
        } else {
          Alert.alert(
            "Bağlantı Hatası",
            "İnternet bağlantınızı kontrol edin ve tekrar deneyin."
          );
        }
      } finally {
        setLoading(false);
      }
    }, 500) as unknown as number;
  };

  const handleSelectPrediction = useCallback(
    async (prediction: Prediction) => {
      setLoading(true);
      setPredictions([]);

      try {
        const details = await getPlaceDetails(prediction.place_id);

        if (details) {
          onSelectLocation({
            latitude: details.latitude,
            longitude: details.longitude,
            address: prediction.description,
          });
          setQuery(prediction.description);
        } else {
          Alert.alert("Hata", "Konum bilgisi alınamadı.");
        }
      } catch (error) {
        console.error("Konum detayı hatası:", error);
        Alert.alert("Hata", "Konum detayları yüklenirken bir sorun oluştu.");
      } finally {
        setLoading(false);
      }
    },
    [onSelectLocation]
  );

  return (
    <View className="w-full">
      <View className="bg-white rounded-xl p-2">
        <View className="flex-row items-center">
          <Text className="text-xl mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-base py-2"
            placeholder={placeholder}
            value={query}
            onChangeText={handleTextChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loading && <ActivityIndicator size="small" color="#2563eb" />}
        </View>

        {predictions.length > 0 && (
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            style={{ maxHeight: 300 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectPrediction(item)}
                className="py-3 px-2 border-t border-gray-100"
              >
                <Text className="text-gray-900 font-medium">
                  {item.structured_formatting.main_text}
                </Text>
                <Text className="text-gray-600 text-sm mt-1">
                  {item.structured_formatting.secondary_text}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
}
