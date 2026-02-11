import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

// Bildirim ayarları
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Expo push token al ve users tablosuna kaydet
 */
export async function registerForPushNotificationsAsync(
  userId: string,
): Promise<string | null> {
  if (!Device.isDevice) {
    // Emülatör/simülatörde push token alınamaz
    return null;
  }

  // İzin kontrolü
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Android kanal ayarı
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Varsayılan",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#047857",
      sound: "default",
    });
  }

  // Token al
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // users tablosuna kaydet
  await (supabase as any)
    .from("users")
    .update({ push_token: token })
    .eq("id", userId);

  return token;
}
