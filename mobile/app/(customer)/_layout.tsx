import { Stack } from "expo-router";

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="add-address" />
      <Stack.Screen name="addresses" />
    </Stack>
  );
}
