import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  add,
  calculateFitrah,
  calculateQibla,
  calculateZakat,
  compassDirection,
  dec,
  div,
  gregorianMonthCalendar,
  gregorianToJd,
  hijriMonthCalendar,
  hijriMonthLength,
  isHijriLeapYear,
  jdToGregorian,
  mul,
  nisabFromMetalPrice,
  qiblaRelativeAngle,
  round,
  sumAmounts,
  toFixed,
  toGregorian,
  toHijri,
  ZAKAT_RULES,
  ZakatInputError,
} from "./index.ts";

describe("decimal", () => {
  it("0.1 + 0.2 = 0.3 tepat", () => {
    assert.equal(toFixed(add(dec("0.1"), dec("0.2")), 2), "0.30");
  });
  it("perkalian dan pembulatan half-up", () => {
    assert.equal(toFixed(mul(dec("1000000.05"), dec("0.025")), 2), "25000.00");
    assert.equal(toFixed(dec("2.5"), 0), "3");
    assert.equal(toFixed(dec("-2.5"), 0), "-3");
    assert.equal(toFixed(round(dec("1.005"), 2), 2), "1.01");
    assert.equal(toFixed(div(dec("10"), dec("3")), 4), "3.3333");
  });
  it("menolak format tidak valid", () => {
    assert.throws(() => dec("1,5"));
    assert.throws(() => dec("abc"));
    assert.throws(() => dec(0.1));
  });
});

describe("qibla", () => {
  const cases = [
    { name: "Jakarta", latitude: -6.2088, longitude: 106.8456, bearing: 295.15, km: 7920 },
    { name: "London", latitude: 51.5074, longitude: -0.1278, bearing: 118.99, km: 4794 },
    { name: "New York", latitude: 40.7128, longitude: -74.006, bearing: 58.48, km: 10306 },
  ];
  for (const c of cases) {
    it(`${c.name}: ${c.bearing}°`, () => {
      const r = calculateQibla(c);
      assert.ok(Math.abs(r.bearing - c.bearing) < 0.1, String(r.bearing));
      assert.ok(Math.abs(r.distanceKm - c.km) < 15, String(r.distanceKm));
    });
  }
  it("arah mata angin dan sudut relatif", () => {
    assert.equal(compassDirection(295), "Barat Laut");
    assert.equal(compassDirection(359), "Utara");
    assert.equal(qiblaRelativeAngle(295, 300), 355);
  });
  it("menolak koordinat tidak valid", () => {
    assert.throws(() => calculateQibla({ latitude: 100, longitude: 0 }), RangeError);
  });
});

describe("hijri (tabular)", () => {
  it("epoch 1 Muharram 1 H = 16 Juli 622 M (kalender Julian)", () => {
    assert.deepEqual(jdToGregorian(1948439.5), { year: 622, month: 7, day: 16 });
    assert.deepEqual(toGregorian({ year: 1, month: 1, day: 1 }), { year: 622, month: 7, day: 16 });
  });
  it("1 Ramadan 1446 H = 1 Maret 2025 dan 1 Ramadan 1447 H = 18 Februari 2026", () => {
    assert.deepEqual(toGregorian({ year: 1446, month: 9, day: 1 }), { year: 2025, month: 3, day: 1 });
    assert.deepEqual(toGregorian({ year: 1447, month: 9, day: 1 }), { year: 2026, month: 2, day: 18 });
  });
  it("konversi bolak-balik konsisten untuk 1900–2100", () => {
    for (let jd = gregorianToJd(1900, 3, 1); jd < gregorianToJd(2100, 1, 1); jd += 37) {
      const g = jdToGregorian(jd);
      const h = toHijri(g);
      assert.deepEqual(toGregorian(h), g);
    }
  });
  it("tahun kabisat dan panjang bulan", () => {
    assert.equal(isHijriLeapYear(2), true);
    assert.equal(isHijriLeapYear(3), false);
    assert.equal(hijriMonthLength(1445, 9), 30);
    assert.equal(hijriMonthLength(1445, 10), 29);
  });
  it("koreksi hari menggeser hasil", () => {
    const base = toHijri({ year: 2026, month: 2, day: 18 });
    const shifted = toHijri({ year: 2026, month: 2, day: 18 }, { adjustmentDays: -1 });
    assert.equal(base.day, 1);
    assert.equal(shifted.month, 8);
    assert.throws(() => toHijri({ year: 2026, month: 1, day: 1 }, { adjustmentDays: 5 }), RangeError);
  });
  it("kalender bulanan memuat hari besar dan hari dalam minggu", () => {
    const march2025 = gregorianMonthCalendar(2025, 3);
    assert.equal(march2025.length, 31);
    assert.equal(march2025[0]?.weekday, 6); // 1 Maret 2025 = Sabtu
    assert.ok(march2025[0]?.events.some((e) => e.key === "ramadan-start"));
    const ramadan = hijriMonthCalendar(1447, 9);
    assert.equal(ramadan.length, 30);
    assert.deepEqual(ramadan[0]?.gregorian, { year: 2026, month: 2, day: 18 });
  });
  it("menolak tanggal tidak valid", () => {
    assert.throws(() => toHijri({ year: 2025, month: 2, day: 29 }), RangeError);
    assert.throws(() => toGregorian({ year: 1446, month: 2, day: 30 }), RangeError);
  });
});

describe("zakat", () => {
  it("zakat tabungan di atas nisab dan sudah haul", () => {
    const r = calculateZakat({ type: "SAVINGS", totalAssets: "150000000", deductibleDebt: "10000000", nisabValue: "110500000", rate: "0.025", haulCompleted: true });
    assert.equal(r.eligible, true);
    assert.equal(r.netAssets, "140000000");
    assert.equal(r.payableAmount, "3500000");
  });
  it("belum haul atau di bawah nisab tidak wajib", () => {
    const base = { type: "GOLD", deductibleDebt: "0", nisabValue: "110500000", rate: "0.025" } as const;
    assert.equal(calculateZakat({ ...base, totalAssets: "200000000", haulCompleted: false }).reason, "HAUL_NOT_COMPLETED");
    const below = calculateZakat({ ...base, totalAssets: "100000000", haulCompleted: true });
    assert.equal(below.reason, "BELOW_NISAB");
    assert.equal(below.payableAmount, "0");
  });
  it("zakat penghasilan tidak memerlukan haul dan memakai nisab bulanan", () => {
    assert.equal(nisabFromMetalPrice(ZAKAT_RULES.INCOME, "1300000"), "9208333");
    const r = calculateZakat({ type: "INCOME", totalAssets: "12000000", deductibleDebt: "0", nisabValue: "9208333", rate: "0.025", haulCompleted: false });
    assert.equal(r.payableAmount, "300000");
  });
  it("utang melebihi harta menghasilkan harta bersih nol", () => {
    const r = calculateZakat({ type: "MAAL", totalAssets: "1000", deductibleDebt: "5000", nisabValue: "1", rate: "0.025", haulCompleted: true });
    assert.equal(r.netAssets, "0");
    assert.equal(r.eligible, false);
  });
  it("nominal pecahan tanpa galat floating point", () => {
    const r = calculateZakat({ type: "MAAL", totalAssets: "100000.10", deductibleDebt: "0.10", nisabValue: "0", rate: "0.025", haulCompleted: true, currencyDecimals: 2 });
    assert.equal(r.payableAmount, "2500.00");
    assert.equal(sumAmounts(["0.1", "0.2", ""], 2), "0.30");
  });
  it("fitrah per jiwa", () => {
    assert.equal(calculateFitrah({ persons: 4, amountPerPerson: "45000" }).total, "180000");
    assert.throws(() => calculateFitrah({ persons: 0, amountPerPerson: "45000" }), ZakatInputError);
  });
  it("menolak nilai negatif dan tarif > 100%", () => {
    const base = { type: "MAAL", deductibleDebt: "0", nisabValue: "0", haulCompleted: true } as const;
    assert.throws(() => calculateZakat({ ...base, totalAssets: "-1", rate: "0.025" }), ZakatInputError);
    assert.throws(() => calculateZakat({ ...base, totalAssets: "1", rate: "1.5" }), ZakatInputError);
  });
});
