import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/services/api";
import { clearPersonalData, getSetting, setSetting } from "@/services/offline/db";
import { useAuth } from "@/stores/auth";
import type { User } from "@/types/domain";

/** Lama sesi offline diizinkan sejak verifikasi online terakhir (kebijakan aplikasi). */
export const OFFLINE_SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface SessionProfile {
  /** Profil minimum untuk UI offline. Bukan kredensial: tanpa token, tanpa password. */
  user: Pick<User, "id" | "name" | "email" | "role" | "emailVerified" | "createdAt">;
  verifiedAt: string;
}

export async function rememberSession(user: User): Promise<void> {
  const profile: SessionProfile = {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, createdAt: user.createdAt },
    verifiedAt: new Date().toISOString(),
  };
  await setSetting("session_profile", profile);
}

/**
 * Memulihkan sesi saat aplikasi dibuka:
 * 1) online → GET /users/me (cookie HttpOnly dikirim otomatis),
 * 2) jaringan gagal → pakai profil tersimpan jika masih dalam batas sesi offline,
 * 3) 401 → belum masuk.
 */
export async function bootstrapSession(): Promise<void> {
  const auth = useAuth.getState();
  try {
    const user = await api.auth.me();
    auth.setAuthenticated(user);
    await rememberSession(user);
  } catch (error) {
    if (isApiError(error) && error.isNetwork) {
      const profile = await getSetting<SessionProfile>("session_profile");
      const fresh = profile && Date.now() - new Date(profile.verifiedAt).getTime() < OFFLINE_SESSION_MAX_AGE_MS;
      if (profile && fresh) {
        auth.setOfflineSession({ ...profile.user, avatarUrl: null });
        return;
      }
    }
    auth.setUnauthenticated();
  }
}

/** Logout: cabut sesi di server, hapus data personal dari perangkat, kosongkan cache query. */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Tetap bersihkan perangkat walaupun server tidak terjangkau.
    }
    await clearPersonalData();
    queryClient.clear();
    useAuth.getState().setUnauthenticated();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);
}
