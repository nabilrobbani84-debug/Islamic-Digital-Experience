import { lazy } from "react";

/**
 * Seluruh scene 3D dimuat secara lazy sehingga three.js/R3F hanya diunduh
 * ketika scene benar-benar ditampilkan (dan tidak pernah pada perangkat fallback 2D).
 */
export const LazyIslamicHeroScene = lazy(() => import("./IslamicHeroScene"));
export const LazyIslamicPortalScene = lazy(() => import("./IslamicPortal"));
export const LazyQuran3DExperience = lazy(() => import("./Quran3DExperience"));
export const LazyQiblaCompass3D = lazy(() => import("./QiblaCompass3D"));
export const LazyPrayerSunScene = lazy(() => import("./PrayerSunScene"));
export const LazyGeometricHalo = lazy(() => import("./GeometricHalo"));
