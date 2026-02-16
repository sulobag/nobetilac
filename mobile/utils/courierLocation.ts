import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";

let locationSubscription: Location.LocationSubscription | null = null;
let realtimeChannel: any = null;
let dbWriteInterval: ReturnType<typeof setInterval> | null = null;
let lastLat: number | null = null;
let lastLng: number | null = null;

const DB_WRITE_INTERVAL = 30_000; // DB'ye her 30 saniye yaz (daha az DB yükü)
const GPS_INTERVAL = 10_000; // GPS her 10 saniye kontrol
const DISTANCE_THRESHOLD = 30; // 30 metre hareket → güncelle

/**
 * Konum izni iste ve foreground konum takibini başlat.
 *
 * Hibrit yaklaşım:
 * 1. GPS konumu expo-location ile alınır
 * 2. Konum Supabase Realtime (WebSocket) broadcast ile anlık yayınlanır
 * 3. DB'ye düşük frekansta (30sn) yazılır (assign-courier API için)
 */
export async function startLocationTracking(courierId: string) {
  // Önce mevcut takibi durdur
  stopLocationTracking();

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Konum izni verilmedi. Konum takibi başlatılamıyor.");
  }

  // Realtime broadcast kanalı aç
  realtimeChannel = (supabase as any).channel(`courier_location_${courierId}`);
  await realtimeChannel.subscribe();

  // İlk konumu hemen gönder (hem DB hem broadcast)
  try {
    const initial = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    lastLat = initial.coords.latitude;
    lastLng = initial.coords.longitude;
    await writeLocationToDb(courierId, lastLat, lastLng);
    broadcastLocation(courierId, lastLat, lastLng);
  } catch {
    // İlk konum alınamazsa takip devam etsin
  }

  // GPS konum takibi → Realtime broadcast (anlık, WebSocket üzerinden)
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: GPS_INTERVAL,
      distanceInterval: DISTANCE_THRESHOLD,
    },
    (location) => {
      lastLat = location.coords.latitude;
      lastLng = location.coords.longitude;
      // Anlık broadcast (WebSocket) → düşük gecikme
      broadcastLocation(courierId, lastLat, lastLng);
    },
  );

  // Periyodik DB yazma (assign-courier API'nin kullanabilmesi için)
  dbWriteInterval = setInterval(async () => {
    if (lastLat != null && lastLng != null) {
      await writeLocationToDb(courierId, lastLat, lastLng);
    }
  }, DB_WRITE_INTERVAL);
}

/**
 * Konum takibini durdur ve tüm kaynakları temizle
 */
export function stopLocationTracking() {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
  if (dbWriteInterval) {
    clearInterval(dbWriteInterval);
    dbWriteInterval = null;
  }
  lastLat = null;
  lastLng = null;
}

/**
 * Konumu Supabase Realtime broadcast ile anlık yayınla (WebSocket)
 * Harita takibi gibi özellikler için çok düşük gecikme
 */
function broadcastLocation(
  courierId: string,
  latitude: number,
  longitude: number,
) {
  if (!realtimeChannel) return;
  try {
    realtimeChannel.send({
      type: "broadcast",
      event: "location_update",
      payload: { courierId, latitude, longitude, timestamp: Date.now() },
    });
  } catch {
    // Broadcast başarısız olursa sessizce devam
  }
}

/**
 * Kurye konumunu veritabanına yaz (periyodik, API sorguları için)
 */
async function writeLocationToDb(
  courierId: string,
  latitude: number,
  longitude: number,
) {
  try {
    await (supabase as any)
      .from("couriers")
      .update({ latitude, longitude })
      .eq("id", courierId);
  } catch {
    // Sessizce devam et
  }
}
