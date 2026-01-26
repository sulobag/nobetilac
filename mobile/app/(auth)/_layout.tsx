import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="customer/login" />
      <Stack.Screen name="customer/register" />
      <Stack.Screen name="courier/login" />
      <Stack.Screen name="courier/register" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}
