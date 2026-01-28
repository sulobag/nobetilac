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

export default function CustomerRegister() {
  const router = useRouter();
  const { signUp, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // Validasyon
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      Alert.alert("Hata", "Lütfen tüm alanları doldurun");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Hata", "Geçerli bir email adresi girin");
      return;
    }

    if (!validatePhone(phone)) {
      Alert.alert(
        "Hata",
        "Telefon numarası 05XX XXX XX XX formatında olmalıdır",
      );
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
      "customer",
    );

    if (error) {
      setLoading(false);
      // Rate limit hatası için özel mesaj
      if (error.message.includes("rate limit")) {
        Alert.alert(
          "Çok Fazla Deneme",
          "Çok fazla kayıt denemesi yaptınız. Lütfen 5-10 dakika bekleyip tekrar deneyin.",
        );
      } else {
        Alert.alert("Kayıt Hatası", error.message);
      }
      return;
    }

    if (needsVerification) {
      setLoading(false);
      Alert.alert(
        "Email Doğrulama",
        `${email} adresinize bir doğrulama kodu gönderdik. Lütfen email'inizi kontrol edin.`,
        [
          {
            text: "Tamam",
            onPress: () =>
              router.push({
                pathname: "/(auth)/verify-email",
                params: { email, userType: "customer" },
              }),
          },
        ],
      );
    } else {
      // Email verification yok, direkt session oluştu
      // Session'ı temizle ve login ekranına yönlendir
      await signOut();
      setLoading(false);

      Alert.alert("Başarılı", "Hesabınız oluşturuldu! Giriş yapın.", [
        { text: "Tamam", onPress: () => router.push("/(auth)/customer/login") },
      ]);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        {/* Header */}
        <View className="mt-12 mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-blue-600 text-base">← Geri</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-gray-900">
            Kullanıcı Kayıt
          </Text>
          <Text className="text-gray-600 mt-2">Yeni hesap oluşturun</Text>
        </View>

        {/* Form */}
        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Ad Soyad
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Ali Yılmaz"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Email
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="ornek@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Telefon
            </Text>
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
              Şifre
            </Text>
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
            className={`bg-blue-600 rounded-xl py-4 mt-6 ${loading ? "opacity-50" : ""}`}
          >
            <Text className="text-white text-center text-lg font-semibold">
              {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/customer/login")}
            className="py-4"
          >
            <Text className="text-center text-gray-600">
              Zaten hesabınız var mı?{" "}
              <Text className="text-blue-600 font-semibold">Giriş Yapın</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
