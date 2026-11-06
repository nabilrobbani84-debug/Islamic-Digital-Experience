import { describe, expect, it } from "vitest";
import { computeZakat, ZAKAT_DEFAULTS, zakatFormSchema } from "./zakat-form";

describe("formulir zakat", () => {
  it("menolak field wajib yang kosong dan angka tidak valid", () => {
    const empty = zakatFormSchema.safeParse({ ...ZAKAT_DEFAULTS, type: "SAVINGS" });
    expect(empty.success).toBe(false);
    const invalid = zakatFormSchema.safeParse({ ...ZAKAT_DEFAULTS, type: "SAVINGS", a: "seratus", price: "1300000" });
    expect(invalid.success).toBe(false);
  });

  it("zakat tabungan: harta bersih di atas nisab dan haul", () => {
    const values = zakatFormSchema.parse({ ...ZAKAT_DEFAULTS, type: "SAVINGS", a: "150.000.000", debt: "10.000.000", price: "1.300.000", haulCompleted: true });
    const r = computeZakat(values);
    expect(r.result.nisab).toBe("110500000");
    expect(r.result.netAssets).toBe("140000000");
    expect(r.result.payableAmount).toBe("3500000");
  });

  it("zakat emas memakai berat × harga dengan desimal", () => {
    const values = zakatFormSchema.parse({ ...ZAKAT_DEFAULTS, type: "GOLD", a: "100,5", price: "1.300.000", haulCompleted: true });
    const r = computeZakat(values);
    expect(r.totalAssets).toBe("130650000");
    expect(r.result.payableAmount).toBe("3266250");
  });

  it("belum haul tidak wajib", () => {
    const values = zakatFormSchema.parse({ ...ZAKAT_DEFAULTS, type: "GOLD", a: "100", price: "1300000", haulCompleted: false });
    expect(computeZakat(values).result.reason).toBe("HAUL_NOT_COMPLETED");
  });

  it("fitrah per jiwa", () => {
    const values = zakatFormSchema.parse({ ...ZAKAT_DEFAULTS, type: "FITRAH", persons: "4", perPerson: "45.000" });
    expect(computeZakat(values).result.payableAmount).toBe("180000");
  });
});
