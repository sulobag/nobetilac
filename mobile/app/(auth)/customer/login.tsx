import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function CustomerLogin() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Hata", "Lütfen tüm alanları doldurun");
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);

    if (error) {
      setLoading(false);
      Alert.alert("Giriş Hatası", error.message);
      return;
    }

    // Adres kontrolü yap ve yönlendir
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: addresses } = await supabase
        .from("addresses")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      setLoading(false);

      if (addresses && addresses.length > 0) {
        router.replace("/(customer)/home");
      } else {
        router.replace({
          pathname: "/(customer)/add-address",
          params: { firstAddress: "true" },
        });
      }
    } else {
      setLoading(false);
      router.replace("/(customer)/home");
    }
  };

  return (
    <View className="flex-1 bg-white p-6">
      {/* Header */}
      <View className="mt-12 mb-8">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-blue-600 text-base">← Geri</Text>
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-gray-900">
          Kullanıcı Girişi
        </Text>
        <Text className="text-gray-600 mt-2">Hesabınıza giriş yapın</Text>
      </View>

      {/* Form */}
      <View className="space-y-4">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
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
          <Text className="text-sm font-medium text-gray-700 mb-2">Şifre</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className={`bg-blue-600 rounded-xl py-4 mt-6 ${loading ? "opacity-50" : ""}`}
        >
          <Text className="text-white text-center text-lg font-semibold">
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/customer/register")}
          className="py-4"
        >
          <Text className="text-center text-gray-600">
            Hesabınız yok mu?{" "}
            <Text className="text-blue-600 font-semibold">Kayıt Olun</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
