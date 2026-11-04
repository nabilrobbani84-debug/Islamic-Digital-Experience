import { describe, expect, it } from "vitest";
import { formatCountdown, formatIdr, groupDigits, parseLocaleNumber, toArabicDigits } from "./format";

describe("format", () => {
  it("parseLocaleNumber menerima format Indonesia", () => {
    expect(parseLocaleNumber("1.250.000")).toBe("1250000");
    expect(parseLocaleNumber("Rp 5.000")).toBe("5000");
    expect(parseLocaleNumber("12,5", true)).toBe("12.5");
    expect(parseLocaleNumber("")).toBe("0");
    expect(parseLocaleNumber("abc")).toBeNull();
    expect(parseLocaleNumber("1,2,3", true)).toBeNull();
  });

  it("formatCountdown menampilkan HH:MM:SS", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(3_723_000)).toBe("01:02:03");
    expect(formatCountdown(-5)).toBe("00:00:00");
  });

  it("formatIdr menangani nilai sangat besar tanpa kehilangan presisi", () => {
    expect(formatIdr("3500000")).toMatch(/3\.500\.000/);
    expect(formatIdr("12345678901234567890")).toBe("Rp 12.345.678.901.234.567.890");
  });

  it("groupDigits dan angka Arab", () => {
    expect(groupDigits("1000000")).toBe("1.000.000");
    expect(toArabicDigits(286)).toBe("٢٨٦");
  });
});
