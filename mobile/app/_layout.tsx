import "../global.css";
import { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppQueryClientProvider } from "@/contexts/QueryClientProvider";
import {
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import * as Notifications from "expo-notifications";

export default function RootLayout() {
  const router = useRouter();
  const notificationResponseListener =
    useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Bildirime tıklanınca siparişler ekranına yönlendir
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.orderId) {
          router.push("/(customer)/orders");
        }
      });

    return () => {
      if (notificationResponseListener.current) {
        Notifications.removeNotificationSubscription(
          notificationResponseListener.current,
        );
      }
    };
  }, [router]);

  return (
    <AppQueryClientProvider>
      <AuthProvider>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback
            onPress={Keyboard.dismiss}
            accessible={false}
          >
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(customer)" />
              <Stack.Screen name="(courier)" />
            </Stack>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </AuthProvider>
    </AppQueryClientProvider>
  );
}
