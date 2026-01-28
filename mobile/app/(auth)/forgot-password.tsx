import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPassword() {
  const router = useRouter();
  const { resetPassword, updatePassword, resendOTP } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert("Hata", "Email adresinizi girin");
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email.trim().toLowerCase());
    setLoading(false);

    if (error) {
      Alert.alert("Hata", error.message);
    } else {
      setCodeSent(true);
      Alert.alert("Başarılı", "Doğrulama kodu email adresinize gönderildi.");
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length !== 6) {
      Alert.alert("Hata", "6 haneli doğrulama kodunu girin");
      return;
    }

    setCodeVerified(true);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert("Hata", "Yeni şifrenizi girin");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Hata", "Şifre en az 6 karakter olmalıdır");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Hata", "Şifreler eşleşmiyor");
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(email, code.trim(), newPassword);

    if (error) {
      setLoading(false);
      Alert.alert("Hata", error.message);
    } else {
      setTimeout(() => {
        setLoading(false);
        Alert.alert(
          "Başarılı",
          "Şifreniz başarıyla güncellendi! Giriş yapabilirsiniz.",
          [
            {
              text: "Giriş Yap",
              onPress: () => {
                router.replace("/(auth)/customer/login");
              },
            },
          ],
        );
      }, 500);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    const { error } = await resendOTP(email);
    setResending(false);

    if (error) {
      Alert.alert("Hata", error.message);
    } else {
      Alert.alert("Başarılı", "Doğrulama kodu tekrar gönderildi");
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-6">
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-blue-600 text-base">← Geri</Text>
        </TouchableOpacity>

        <Text className="text-3xl font-bold text-gray-900 mb-2">
          Şifremi Unuttum
        </Text>
        <Text className="text-gray-600 mb-8">
          {!codeSent
            ? "Email adresinizi girin, size doğrulama kodu gönderelim."
            : codeVerified
              ? "Yeni şifrenizi belirleyin."
              : "Email adresinize gönderilen 6 haneli kodu girin."}
        </Text>

        <View className="mb-6">
          <Text className="text-gray-700 font-medium mb-2">Email</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="ornek@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading && !codeSent}
          />
        </View>

        {codeSent && !codeVerified && (
          <>
            <View className="mb-6">
              <Text className="text-gray-700 font-medium mb-2">
                Doğrulama Kodu
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base text-center text-2xl tracking-widest"
                placeholder="000000"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              onPress={handleVerifyCode}
              disabled={loading}
              className={`rounded-xl py-4 items-center mb-4 ${
                loading ? "bg-blue-400" : "bg-blue-600"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">
                  Kodu Doğrula
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResendCode}
              disabled={resending}
              className="py-3 items-center"
            >
              <Text className="text-blue-600 font-medium">
                {resending ? "Gönderiliyor..." : "Kodu Tekrar Gönder"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {codeVerified && (
          <>
            <View className="mb-6">
              <Text className="text-gray-700 font-medium mb-2">Yeni Şifre</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                placeholder="En az 6 karakter"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View className="mb-6">
              <Text className="text-gray-700 font-medium mb-2">
                Yeni Şifre (Tekrar)
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                placeholder="Şifrenizi tekrar girin"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              onPress={handleUpdatePassword}
              disabled={loading}
              className={`rounded-xl py-4 items-center ${
                loading ? "bg-blue-400" : "bg-blue-600"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">
                  Şifremi Güncelle
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {!codeSent && (
          <TouchableOpacity
            onPress={handleSendCode}
            disabled={loading}
            className={`rounded-xl py-4 items-center ${
              loading ? "bg-blue-400" : "bg-blue-600"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">
                Kod Gönder
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
