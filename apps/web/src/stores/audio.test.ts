import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/api", async () => {
  const errors = await vi.importActual<typeof import("@/services/api/errors")>("@/services/api/errors");
  return {
    ...errors,
    api: {
      audio: {
        surah: vi.fn(async () => {
          throw new errors.ApiError(501, "NOT_SUPPORTED", "not supported");
        }),
      },
    },
  };
});

const { useAudio } = await import("./audio");

describe("audio store", () => {
  it("menampilkan status 'unavailable' yang jelas bila provider tidak menyediakan audio", async () => {
    await useAudio.getState().load({ surahNumber: 1, surahName: "Contoh", totalVerses: 7, qariId: "q", qariName: "Qari" });
    expect(useAudio.getState().status).toBe("unavailable");
    expect(useAudio.getState().message).toMatch(/belum tersedia/);
  });

  it("siklus repeat tanpa segmen ayat hanya off ↔ surah", () => {
    useAudio.setState({ repeat: "off", track: null });
    useAudio.getState().cycleRepeat();
    expect(useAudio.getState().repeat).toBe("surah");
    useAudio.getState().cycleRepeat();
    expect(useAudio.getState().repeat).toBe("off");
  });
});
