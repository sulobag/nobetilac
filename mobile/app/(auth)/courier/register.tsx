import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { validateEmail, validatePhone } from "@/utils/helpers";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";

export default function CourierRegister() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [vehicleType, setVehicleType] = useState<
    "motorcycle" | "car" | "bicycle" | "scooter" | null
  >(null);
  const [loading, setLoading] = useState(false);

  const vehicleTypes: Array<"motorcycle" | "car" | "bicycle" | "scooter"> = [
    "motorcycle",
    "car",
    "bicycle",
    "scooter",
  ];

  const handleRegister = async () => {
    // Validasyon
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      Alert.alert("Hata", "Lütfen tüm alanları doldurun");
      return;
    }

    if (!vehicleType) {
      Alert.alert("Hata", "Lütfen araç tipini seçin");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Hata", "Geçerli bir email adresi girin");
      return;
    }

    if (!validatePhone(phone)) {
      Alert.alert("Hata", "Telefon numarası 05XX XXX XX XX formatında olmalıdır");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Hata", "Şifre en az 6 karakter olmalıdır");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Hata", "Şifreler eşleşmiyor");
      return;
    }

    setLoading(true);
    const { error, needsVerification } = await signUp(
      email,
      password,
      phone,
      fullName,
      "courier",
      vehicleType
    );
    setLoading(false);

    if (error) {
      // Rate limit hatası için özel mesaj
      if (error.message.includes('rate limit')) {
        Alert.alert(
          "Çok Fazla Deneme", 
          "Çok fazla kayıt denemesi yaptınız. Lütfen 5-10 dakika bekleyip tekrar deneyin."
        );
      } else {
        Alert.alert("Kayıt Hatası", error.message);
      }
    } else if (needsVerification) {
      Alert.alert(
        "Email Doğrulama",
        `${email} adresinize bir doğrulama kodu gönderdik. Lütfen email'inizi kontrol edin.`,
        [
          {
            text: "Tamam",
            onPress: () => router.push({
              pathname: "/(auth)/verify-email",
              params: { email, userType: 'courier' }
            }),
          },
        ]
      );
    } else {
      Alert.alert(
        "Başarılı",
        "Kurye hesabınız oluşturuldu! Giriş yapabilirsiniz.",
        [
          {
            text: "Tamam",
            onPress: () => router.replace("/(auth)/courier/login"),
          },
        ]
      );
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        {/* Header */}
        <View className="mt-12 mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-green-600 text-base">← Geri</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-gray-900">Kurye Kayıt</Text>
          <Text className="text-gray-600 mt-2">Yeni kurye hesabı oluşturun</Text>
        </View>

        {/* Form */}
        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Ad Soyad
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Ahmet Kurye"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="kurye@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Telefon</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="05XX XXX XX XX"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Araç Tipi
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {vehicleTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setVehicleType(type)}
                  className={`px-4 py-2 rounded-lg border-2 ${
                    vehicleType === type
                      ? "bg-green-600 border-green-600"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <Text
                    className={`text-base ${
                      vehicleType === type ? "text-white font-semibold" : "text-gray-700"
                    }`}
                  >
                    {VEHICLE_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Şifre</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="En az 6 karakter"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Şifre Tekrar
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Şifrenizi tekrar girin"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className={`bg-green-600 rounded-xl py-4 mt-6 ${
              loading ? "opacity-50" : ""
            }`}
          >
            <Text className="text-white text-center text-lg font-semibold">
              {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/courier/login")}
            className="py-4"
          >
            <Text className="text-center text-gray-600">
              Zaten kurye hesabınız var mı?{" "}
              <Text className="text-green-600 font-semibold">Giriş Yapın</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
