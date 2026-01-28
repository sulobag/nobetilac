import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyEmail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { verifyOTP, resendOTP } = useAuth();

  const email = params.email as string;
  const userType = params.userType as "customer" | "courier";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert("Hata", "Lütfen 6 haneli kodu girin");
      return;
    }

    setLoading(true);
    const { error, session } = await verifyOTP(email, otp);
    setLoading(false);

    if (error) {
      Alert.alert(
        "Doğrulama Hatası",
        "Kod geçersiz veya süresi dolmuş. Lütfen tekrar deneyin.",
      );
    } else {
      Alert.alert(
        "Başarılı!",
        "Email adresiniz doğrulandı. Yönlendiriliyorsunuz...",
        [
          {
            text: "Tamam",
            onPress: () => {
              router.replace("/");
            },
          },
        ],
      );
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setResending(true);
    const { error } = await resendOTP(email);
    setResending(false);

    if (error) {
      Alert.alert(
        "Hata",
        "Kod tekrar gönderilemedi. Lütfen daha sonra tekrar deneyin.",
      );
    } else {
      Alert.alert("Başarılı", "Yeni kod email adresinize gönderildi.");
      setCountdown(60);
      setCanResend(false);
    }
  };

  const color = userType === "customer" ? "blue" : "green";

  return (
    <View className="flex-1 bg-white p-6">
      {/* Header */}
      <View className="mt-12 mb-8">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className={`text-${color}-600 text-base`}>← Geri</Text>
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-gray-900">
          Email Doğrulama
        </Text>
        <Text className="text-gray-600 mt-2">
          {email} adresine gönderilen 6 haneli kodu girin
        </Text>
      </View>

      {/* OTP Input */}
      <View className="space-y-4">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Doğrulama Kodu
          </Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest"
            placeholder="000000"
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        </View>

        <TouchableOpacity
          onPress={handleVerify}
          disabled={loading || otp.length !== 6}
          className={`${
            userType === "customer" ? "bg-blue-600" : "bg-green-600"
          } rounded-xl py-4 mt-6 ${loading || otp.length !== 6 ? "opacity-50" : ""}`}
        >
          <Text className="text-white text-center text-lg font-semibold">
            {loading ? "Doğrulanıyor..." : "Doğrula"}
          </Text>
        </TouchableOpacity>

        {/* Resend Section */}
        <View className="mt-6">
          <Text className="text-center text-gray-600 mb-2">
            Kod gelmedi mi?
          </Text>
          {canResend ? (
            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              className="py-2"
            >
              <Text
                className={`text-center font-semibold ${
                  userType === "customer" ? "text-blue-600" : "text-green-600"
                }`}
              >
                {resending ? "Gönderiliyor..." : "Tekrar Gönder"}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text className="text-center text-gray-500">
              {countdown} saniye sonra tekrar gönderebilirsiniz
            </Text>
          )}
        </View>

        {/* Info Box */}
        <View className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <Text className="text-sm text-gray-700">
            💡 <Text className="font-semibold">İpucu:</Text> Kod spam/junk
            klasörünüze düşmüş olabilir. Kod 10 dakika geçerlidir.
          </Text>
        </View>
      </View>
    </View>
  );
}
