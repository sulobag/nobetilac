import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
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
          ]
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
            <TouchableOpacity onPress={() => router.back()} className="mb-4">
              <Text className="text-emerald-600 text-base">← Geri</Text>
            </TouchableOpacity>

            <Text className="text-xs font-semibold text-emerald-600 uppercase">
              Nöbet İlaç
            </Text>
            <Text className="text-3xl font-bold text-gray-900 mt-1 mb-2">
              Şifremi Unuttum
            </Text>
            <Text className="text-gray-600 mb-6 text-sm">
              {!codeSent
                ? "Email adresinizi girin, size doğrulama kodu gönderelim."
                : codeVerified
                  ? "Yeni şifrenizi belirleyin."
                  : "Email adresinize gönderilen 6 haneli kodu girin."}
            </Text>

            <View className="bg-white rounded-2xl px-4 py-6 border border-gray-100 mb-4">
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">Email</Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
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
                  <View className="mb-4">
                    <Text className="text-gray-700 font-medium mb-2">
                      Doğrulama Kodu
                    </Text>
                    <TextInput
                      className="border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl tracking-widest bg-gray-50"
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
                    className={`rounded-xl py-3 items-center mb-2 ${
                      loading ? "bg-emerald-400" : "bg-emerald-600"
                    }`}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ECFDF5" />
                    ) : (
                      <Text className="text-white font-semibold text-base">
                        Kodu Doğrula
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleResendCode}
                    disabled={resending}
                    className="py-2 items-center"
                  >
                    <Text className="text-emerald-600 font-medium text-sm">
                      {resending ? "Gönderiliyor..." : "Kodu Tekrar Gönder"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {codeVerified && (
                <>
                  <View className="mb-4">
                    <Text className="text-gray-700 font-medium mb-2">
                      Yeni Şifre
                    </Text>
                    <TextInput
                      className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                      placeholder="En az 6 karakter"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      editable={!loading}
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="text-gray-700 font-medium mb-2">
                      Yeni Şifre (Tekrar)
                    </Text>
                    <TextInput
                      className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
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
                    className={`rounded-xl py-3 items-center ${
                      loading ? "bg-emerald-400" : "bg-emerald-600"
                    }`}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ECFDF5" />
                    ) : (
                      <Text className="text-white font-semibold text-base">
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
                  className={`rounded-xl py-3 items-center ${
                    loading ? "bg-emerald-400" : "bg-emerald-600"
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator color="#ECFDF5" />
                  ) : (
                    <Text className="text-white font-semibold text-base">
                      Kod Gönder
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
