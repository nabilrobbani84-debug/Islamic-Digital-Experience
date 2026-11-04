export type AsrMadhhab = "STANDARD" | "HANAFI";

export type HighLatitudeRule = "ANGLE_BASED" | "MIDDLE_OF_NIGHT" | "ONE_SEVENTH";

export interface PrayerMethod {
  code: string;
  name: string;
  fajrAngle: number;
  /** Sudut Isya. Abaikan jika ishaIntervalMinutes diisi. */
  ishaAngle?: number;
  /** Isya = Maghrib + interval tetap (misalnya Umm al-Qura). */
  ishaIntervalMinutes?: number;
  /** Menit pengaman (ihtiyath) yang ditambahkan ke setiap waktu, dikurangkan dari terbit. */
  ihtiyatMinutes: number;
  /** true jika parameter sudah dicocokkan dengan dokumen resmi penerbit metode. */
  verified: boolean;
  note?: string;
}

/**
 * Parameter metode umum. Sudut diambil dari parameter yang dipublikasikan luas
 * (misalnya dokumentasi PrayTimes). Kemenag RI ditandai belum terverifikasi sampai
 * dicocokkan dengan dokumen resmi Kementerian Agama.
 */
export const PRAYER_METHODS: Record<string, PrayerMethod> = {
  KEMENAG_RI: {
    code: "KEMENAG_RI",
    name: "Kementerian Agama RI",
    fajrAngle: 20,
    ishaAngle: 18,
    ihtiyatMinutes: 2,
    verified: false,
    note: "Parameter umum (Subuh 20°, Isya 18°, ihtiyath 2 menit). Perlu dicocokkan dengan dokumen resmi Kemenag.",
  },
  MWL: {
    code: "MWL",
    name: "Muslim World League",
    fajrAngle: 18,
    ishaAngle: 17,
    ihtiyatMinutes: 0,
    verified: false,
  },
  ISNA: {
    code: "ISNA",
    name: "Islamic Society of North America",
    fajrAngle: 15,
    ishaAngle: 15,
    ihtiyatMinutes: 0,
    verified: false,
  },
  EGYPT: {
    code: "EGYPT",
    name: "Egyptian General Authority of Survey",
    fajrAngle: 19.5,
    ishaAngle: 17.5,
    ihtiyatMinutes: 0,
    verified: false,
  },
  UMM_AL_QURA: {
    code: "UMM_AL_QURA",
    name: "Umm al-Qura, Makkah",
    fajrAngle: 18.5,
    ishaIntervalMinutes: 90,
    ihtiyatMinutes: 0,
    verified: false,
    note: "Saat Ramadan, otoritas setempat memakai interval Isya 120 menit.",
  },
  JAKIM: {
    code: "JAKIM",
    name: "JAKIM Malaysia",
    fajrAngle: 20,
    ishaAngle: 18,
    ihtiyatMinutes: 0,
    verified: false,
  },
};

export const DEFAULT_METHOD_CODE = "KEMENAG_RI";

export function getPrayerMethod(code: string): PrayerMethod {
  const method = PRAYER_METHODS[code];
  if (!method) throw new RangeError(`Metode perhitungan tidak dikenal: ${code}`);
  return method;
}
