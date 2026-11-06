import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { AppLayout } from "./layouts/AppLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { NotFoundPage, PageLoader, RouteErrorBoundary } from "@/components/feedback/RouteFallbacks";

/** Lazy route: setiap halaman menjadi chunk terpisah (code splitting). */
const page = (loader: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await loader()).default });

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      { index: true, lazy: page(() => import("@/features/home/LandingPage")) },
      {
        element: <AuthLayout />,
        children: [
          { path: "login", lazy: page(() => import("@/features/auth/LoginPage")) },
          { path: "register", lazy: page(() => import("@/features/auth/RegisterPage")) },
          { path: "forgot-password", lazy: page(() => import("@/features/auth/ForgotPasswordPage")) },
        ],
      },
      {
        element: <AuthLayout guestOnly={false} />,
        children: [
          { path: "verify-email", lazy: page(() => import("@/features/auth/VerifyEmailPage")) },
          { path: "reset-password", lazy: page(() => import("@/features/auth/ResetPasswordPage")) },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          { path: "dashboard", lazy: page(() => import("@/features/home/dashboard/DashboardPage")) },
          { path: "quran", lazy: page(() => import("@/features/quran/QuranLandingPage")) },
          { path: "quran/:surahNumber", lazy: page(() => import("@/features/quran/QuranReaderPage")) },
          { path: "prayer", lazy: page(() => import("@/features/prayer/PrayerPage")) },
          { path: "qibla", lazy: page(() => import("@/features/qibla/QiblaPage")) },
          { path: "calendar", lazy: page(() => import("@/features/calendar/CalendarPage")) },
          { path: "zakat", lazy: page(() => import("@/features/zakat/ZakatPage")) },
          { path: "asmaul-husna", lazy: page(() => import("@/features/asmaul-husna/AsmaulHusnaPage")) },
          { path: "dhikr", lazy: page(() => import("@/features/dhikr/DhikrPage")) },
          { path: "duas", lazy: page(() => import("@/features/duas/DuasPage")) },
          { path: "hadith", lazy: page(() => import("@/features/hadith/HadithPage")) },
          { path: "hadith/:number", lazy: page(() => import("@/features/hadith/HadithDetailPage")) },
          { path: "profile", lazy: page(() => import("@/features/profile/ProfilePage")) },
          { path: "settings", lazy: page(() => import("@/features/profile/SettingsPage")) },
          { path: "settings/offline-data", lazy: page(() => import("@/features/profile/OfflineDataPage")) },
          { path: "admin/*", lazy: page(() => import("@/features/admin/AdminRoot")) },
        ],
      },
      { path: "home", element: <Navigate to="/dashboard" replace /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
