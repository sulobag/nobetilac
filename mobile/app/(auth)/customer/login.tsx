import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from "react-native";
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View className="flex-1 bg-gray-50">
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingVertical: 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-8">
              <TouchableOpacity onPress={() => router.back()} className="mb-4">
                <Text className="text-emerald-600 text-base">← Geri</Text>
              </TouchableOpacity>
              <Text className="text-xs font-semibold text-emerald-600 uppercase">
                Nöbet İlaç
              </Text>
              <Text className="text-3xl font-bold text-gray-900 mt-1">
                Hoş geldiniz
              </Text>
              <Text className="text-gray-600 mt-2 text-sm">
                Giriş yaparak reçetelerinizi kolayca yönetin.
              </Text>
            </View>

            <View className="bg-white rounded-2xl px-4 py-6 border border-gray-100">
              <View className="space-y-4">
                <View>
                  <Text className="text-sm font-medium text-gray-700 mb-2">
                    Email
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
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
                    Şifre
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => router.push("/(auth)/forgot-password")}
                    className="mt-2 self-end"
                  >
                    <Text className="text-emerald-600 text-sm">
                      Şifremi Unuttum?
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={loading}
                  className={`bg-emerald-600 rounded-xl py-4 mt-2 ${
                    loading ? "opacity-50" : ""
                  }`}
                >
                  <Text className="text-white text-center text-lg font-semibold">
                    {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/(auth)/customer/register")}
                  className="py-4"
                >
                  <Text className="text-center text-gray-600 text-sm">
                    Hesabınız yok mu?{" "}
                    <Text className="text-emerald-600 font-semibold">
                      Kayıt Olun
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
