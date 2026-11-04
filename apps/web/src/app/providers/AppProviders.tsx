import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { isApiError } from "@/services/api";
import { usePreferences } from "@/stores/preferences";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        networkMode: "offlineFirst",
        // Retry hanya untuk error jaringan/5xx, maksimal 2 kali dengan backoff.
        retry: (failureCount, error) => failureCount < 2 && (!isApiError(error) || error.isRetryable),
        retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 6000),
      },
      mutations: { retry: false, networkMode: "offlineFirst" },
    },
  });
}

function ThemeSync() {
  const theme = usePreferences((s) => s.theme);
  const reduced = usePreferences((s) => s.reducedMotion);
  const arabic = usePreferences((s) => s.arabicFontSize);
  const translation = usePreferences((s) => s.translationFontSize);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("reduce-motion", reduced);
    root.style.setProperty("--nur-arabic-size", `${arabic}px`);
    root.style.setProperty("--nur-translation-size", `${translation}px`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#080D17" : "#F7F6F0");
  }, [theme, reduced, arabic, translation]);
  return null;
}

function MotionPreferences({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return <MotionConfig reducedMotion={reduced ? "always" : "never"}>{children}</MotionConfig>;
}

export function AppProviders({ children, queryClient }: { children: ReactNode; queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <ThemeSync />
      <MotionPreferences>{children}</MotionPreferences>
    </QueryClientProvider>
  );
}
