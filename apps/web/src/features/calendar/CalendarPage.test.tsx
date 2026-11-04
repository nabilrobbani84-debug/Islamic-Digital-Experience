import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/tests/render";
import { usePrayerSettings } from "@/stores/prayer-settings";
import CalendarPage from "./CalendarPage";

describe("CalendarPage", () => {
  it("navigasi bulan dan beralih ke kalender Hijriah", async () => {
    const user = userEvent.setup();
    usePrayerSettings.setState({ location: { name: "Jakarta", latitude: -6.2, longitude: 106.8, elevation: 0, timezone: "Asia/Jakarta", source: "preset" }, hijriAdjustment: 0 });
    renderWithProviders(<CalendarPage />);
    const heading = screen.getByTestId("calendar-title");
    const initial = heading.textContent;
    await user.click(screen.getByRole("button", { name: "Bulan berikutnya" }));
    expect(heading.textContent).not.toBe(initial);
    await user.click(screen.getByRole("button", { name: "Hari ini" }));
    expect(heading.textContent).toBe(initial);

    await user.click(screen.getByRole("radio", { name: "Hijriah" }));
    expect(screen.getByTestId("calendar-title").textContent).toMatch(/\d{4} H$/);
  });

  it("koreksi hari dibatasi -2..+2", async () => {
    const user = userEvent.setup();
    usePrayerSettings.setState({ hijriAdjustment: 2 });
    renderWithProviders(<CalendarPage />);
    expect(screen.getByRole("button", { name: "Tambah satu hari" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Kurangi satu hari" }));
    expect(usePrayerSettings.getState().hijriAdjustment).toBe(1);
  });
});
