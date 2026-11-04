import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysIso,
  calculatePrayerTimes,
  findNextPrayer,
  formatMinutes,
  PRAYER_METHODS,
  PrayerInputError,
  toPrayerSchedule,
  type PrayerKey,
} from "../index.ts";

const NO_IHTIYAT = { ...PRAYER_METHODS.MWL!, ihtiyatMinutes: 0 };

function minutesOf(result: ReturnType<typeof calculatePrayerTimes>, key: PrayerKey): number {
  const value = result.times[key];
  assert.ok(value, `${key} harus ada`);
  return value.minutes;
}

describe("calculatePrayerTimes — vektor uji astronomi", () => {
  it("solar noon Greenwich 3 Nov 2024 ≈ 11:43:36 UTC (equation of time +16,4 menit)", () => {
    const r = calculatePrayerTimes({ latitude: 51.4769, longitude: 0, date: "2024-11-03", timezone: "UTC", method: NO_IHTIYAT });
    assert.ok(Math.abs(minutesOf(r, "dhuhr") - 703.6) <= 1);
  });

  it("solar noon Greenwich 11 Feb 2024 ≈ 12:14:13 UTC (equation of time −14,2 menit)", () => {
    const r = calculatePrayerTimes({ latitude: 51.4769, longitude: 0, date: "2024-02-11", timezone: "UTC", method: NO_IHTIYAT });
    assert.ok(Math.abs(minutesOf(r, "dhuhr") - 734.2) <= 1);
  });

  it("Jakarta 4 Nov 2026 (parameter Kemenag umum) berada dalam ±3 menit jadwal referensi", () => {
    const r = calculatePrayerTimes({ latitude: -6.2088, longitude: 106.8456, date: "2026-11-04", timezone: "Asia/Jakarta", method: "KEMENAG_RI" });
    const expected: Record<PrayerKey, string> = {
      fajr: "04:07",
      sunrise: "05:24",
      dhuhr: "11:38",
      asr: "14:57",
      maghrib: "17:49",
      isha: "19:01",
    };
    for (const [key, label] of Object.entries(expected) as [PrayerKey, string][]) {
      const [h, m] = label.split(":").map(Number);
      const diff = Math.abs(minutesOf(r, key) - ((h ?? 0) * 60 + (m ?? 0)));
      assert.ok(diff <= 3, `${key}: ${r.times[key]?.label} vs ${label}`);
    }
    assert.equal(r.methodVerified, false);
  });

  it("urutan waktu selalu Subuh < Terbit < Dzuhur < Ashar < Maghrib < Isya", () => {
    const cities = [
      { latitude: -6.2088, longitude: 106.8456, timezone: "Asia/Jakarta" },
      { latitude: 21.4225, longitude: 39.8262, timezone: "Asia/Riyadh" },
      { latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" },
      { latitude: -33.8688, longitude: 151.2093, timezone: "Australia/Sydney" },
    ];
    for (const city of cities) {
      for (const date of ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]) {
        const r = calculatePrayerTimes({ ...city, date, method: "MWL" });
        const order = (["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const).map((k) => minutesOf(r, k));
        for (let i = 1; i < order.length; i++) {
          assert.ok((order[i] ?? 0) > (order[i - 1] ?? 0), `${city.timezone} ${date}`);
        }
      }
    }
  });

  it("memakai zona waktu lokasi, termasuk hari pergantian daylight saving (New York, 8 Mar 2026)", () => {
    const before = calculatePrayerTimes({ latitude: 40.7128, longitude: -74.006, date: "2026-03-07", timezone: "America/New_York", method: "ISNA" });
    const after = calculatePrayerTimes({ latitude: 40.7128, longitude: -74.006, date: "2026-03-08", timezone: "America/New_York", method: "ISNA" });
    const jump = minutesOf(after, "dhuhr") - minutesOf(before, "dhuhr");
    assert.ok(jump >= 59 && jump <= 61, `lompatan DST ${jump} menit`);
  });

  it("Umm al-Qura: Isya = Maghrib + 90 menit", () => {
    const r = calculatePrayerTimes({ latitude: 21.4225, longitude: 39.8262, date: "2026-11-04", timezone: "Asia/Riyadh", method: "UMM_AL_QURA" });
    assert.equal(minutesOf(r, "isha") - minutesOf(r, "maghrib"), 90);
  });

  it("madzhab Hanafi menghasilkan Ashar lebih lambat", () => {
    const base = { latitude: -6.2088, longitude: 106.8456, date: "2026-11-04", timezone: "Asia/Jakarta", method: "KEMENAG_RI" } as const;
    const standard = calculatePrayerTimes(base);
    const hanafi = calculatePrayerTimes({ ...base, asrMadhhab: "HANAFI" });
    assert.ok(minutesOf(hanafi, "asr") - minutesOf(standard, "asr") > 30);
  });

  it("penyesuaian manual menggeser waktu sesuai menit", () => {
    const base = { latitude: -6.2088, longitude: 106.8456, date: "2026-11-04", timezone: "Asia/Jakarta", method: "KEMENAG_RI" } as const;
    const a = calculatePrayerTimes(base);
    const b = calculatePrayerTimes({ ...base, adjustments: { maghrib: 3 } });
    assert.equal(minutesOf(b, "maghrib") - minutesOf(a, "maghrib"), 3);
  });

  it("lintang tinggi musim panas (London) memakai aturan pengganti, bukan NaN", () => {
    const r = calculatePrayerTimes({ latitude: 51.5074, longitude: -0.1278, date: "2026-06-21", timezone: "Europe/London", method: "MWL" });
    assert.equal(r.highLatitudeRuleApplied, "ANGLE_BASED");
    assert.ok(r.times.fajr && r.times.isha);
  });

  it("matahari tengah malam (Tromsø, Juni) mengembalikan null untuk terbit/terbenam", () => {
    const r = calculatePrayerTimes({ latitude: 69.6492, longitude: 18.9553, date: "2026-06-21", timezone: "Europe/Oslo", method: "MWL" });
    assert.equal(r.times.sunrise, null);
    assert.equal(r.times.maghrib, null);
    assert.ok(r.times.dhuhr);
    assert.equal(toPrayerSchedule(r).maghrib, "--:--");
  });

  it("menolak input tidak valid", () => {
    const base = { latitude: 0, longitude: 0, date: "2026-01-01", timezone: "UTC", method: "MWL" } as const;
    assert.throws(() => calculatePrayerTimes({ ...base, latitude: 91 }), PrayerInputError);
    assert.throws(() => calculatePrayerTimes({ ...base, longitude: -181 }), PrayerInputError);
    assert.throws(() => calculatePrayerTimes({ ...base, date: "2026-02-30" }), PrayerInputError);
    assert.throws(() => calculatePrayerTimes({ ...base, timezone: "Mars/Olympus" }), PrayerInputError);
    assert.throws(() => calculatePrayerTimes({ ...base, method: "UNKNOWN" }), RangeError);
  });
});

describe("findNextPrayer", () => {
  const base = { latitude: -6.2088, longitude: 106.8456, timezone: "Asia/Jakarta", method: "KEMENAG_RI" } as const;
  const today = calculatePrayerTimes({ ...base, date: "2026-11-04" });
  const tomorrow = calculatePrayerTimes({ ...base, date: addDaysIso("2026-11-04", 1) });

  it("setelah Dzuhur, waktu berikutnya adalah Ashar dan waktu saat ini Dzuhur", () => {
    const now = new Date("2026-11-04T06:00:00Z"); // 13:00 WIB
    const next = findNextPrayer(today, tomorrow, now);
    assert.equal(next?.key, "asr");
    assert.equal(next?.current, "dhuhr");
    assert.ok((next?.remainingMs ?? 0) > 0);
  });

  it("setelah Isya, waktu berikutnya adalah Subuh besok", () => {
    const now = new Date("2026-11-04T15:00:00Z"); // 22:00 WIB
    const next = findNextPrayer(today, tomorrow, now);
    assert.equal(next?.key, "fajr");
    assert.ok(next && next.instant.toISOString().startsWith("2026-11-04T2"));
  });

  it("di antara terbit dan Dzuhur tidak ada waktu wajib yang berlangsung", () => {
    const now = new Date("2026-11-04T01:00:00Z"); // 08:00 WIB
    assert.equal(findNextPrayer(today, tomorrow, now)?.current, null);
  });
});

describe("format", () => {
  it("formatMinutes menormalkan nilai melewati tengah malam", () => {
    assert.equal(formatMinutes(0), "00:00");
    assert.equal(formatMinutes(1439), "23:59");
    assert.equal(formatMinutes(1500), "01:00");
  });
  it("addDaysIso melewati akhir bulan dan tahun kabisat", () => {
    assert.equal(addDaysIso("2028-02-28", 1), "2028-02-29");
    assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
  });
});
