import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppQueryClientProvider } from "@/contexts/QueryClientProvider";
import {
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";

export default function RootLayout() {
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
