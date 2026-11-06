import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/render";
import { usePrayerSettings } from "@/stores/prayer-settings";
import QiblaPage from "./QiblaPage";

describe("QiblaPage", () => {
  it("meminta lokasi jika belum diatur", () => {
    usePrayerSettings.setState({ location: null });
    renderWithProviders(<QiblaPage />);
    expect(screen.getByText("Lokasi diperlukan")).toBeInTheDocument();
  });

  it("tanpa sensor: menampilkan derajat kiblat, kompas 2D, dan tidak mengklaim akurat", () => {
    usePrayerSettings.setState({ location: { name: "Jakarta", latitude: -6.2088, longitude: 106.8456, elevation: 8, timezone: "Asia/Jakarta", source: "preset" } });
    renderWithProviders(<QiblaPage />);
    expect(screen.getByText("295.15°")).toBeInTheDocument();
    expect(screen.getByTestId("qibla-compass-2d")).toBeInTheDocument();
    expect(screen.getByText(/Kompas tidak aktif/)).toBeInTheDocument();
    expect(screen.getByText("Sensor tidak aktif")).toBeInTheDocument();
  });
});
