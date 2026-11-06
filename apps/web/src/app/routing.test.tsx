import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AppProviders } from "./providers/AppProviders";
import { routes } from "./router";
import { createTestQueryClient } from "@/tests/render";
import { useAuth } from "@/stores/auth";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders queryClient={createTestQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe("routing", () => {
  it("landing publik dirender dengan fallback 2D saat WebGL tidak tersedia", async () => {
    useAuth.setState({ status: "unauthenticated", user: null });
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: /Your Spiritual Journey, Reimagined/ })).toBeInTheDocument();
    expect(screen.getByTestId("hero-fallback")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start Reading Quran/ })).toHaveAttribute("href", "/quran");
  });

  it("halaman aplikasi wajib login: /dashboard diarahkan ke /login dengan parameter next", async () => {
    const router = renderAt("/dashboard");
    expect(await screen.findByRole("heading", { name: "Masuk ke NUR" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toContain("next=%2Fdashboard");
  });

  it("rute tidak dikenal menampilkan 404", async () => {
    renderAt("/tidak-ada");
    expect(await screen.findByText("Halaman tidak ditemukan")).toBeInTheDocument();
  });
});
