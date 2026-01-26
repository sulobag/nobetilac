// Kullanıcı Rolleri
export const USER_ROLES = {
  CUSTOMER: 'customer',
  COURIER: 'courier',
  ADMIN: 'admin',
} as const;

// Araç Tipleri
export const VEHICLE_TYPES = {
  MOTORCYCLE: 'motorcycle',
  CAR: 'car',
  BICYCLE: 'bicycle',
  SCOOTER: 'scooter',
} as const;

// Araç Tipi Görselleri/İkonları
export const VEHICLE_TYPE_LABELS = {
  motorcycle: 'Motosiklet',
  car: 'Araba',
  bicycle: 'Bisiklet',
  scooter: 'Scooter',
} as const;

// Adres Tipleri
export const ADDRESS_TYPES = [
  { label: 'Ev', value: 'Ev' },
  { label: 'İş', value: 'İş' },
  { label: 'Diğer', value: 'Diğer' },
] as const;

// Türkiye Şehirleri (İlk 10 büyük şehir - gerekirse tamamı eklenebilir)
export const CITIES = [
  'İstanbul',
  'Ankara',
  'İzmir',
  'Bursa',
  'Antalya',
  'Adana',
  'Konya',
  'Gaziantep',
  'Şanlıurfa',
  'Kocaeli',
] as const;

// Telefon Regex (TR Format)
export const PHONE_REGEX = /^0[5][0-9]{9}$/;

// Email Regex
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
