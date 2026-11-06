import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePreferences } from "@/stores/preferences";
import { useReducedMotion } from "./useReducedMotion";

describe("useReducedMotion", () => {
  it("mengikuti preferensi aplikasi walaupun sistem tidak meminta", () => {
    usePreferences.setState({ reducedMotion: false });
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => usePreferences.getState().set({ reducedMotion: true }));
    expect(result.current).toBe(true);
  });
});
