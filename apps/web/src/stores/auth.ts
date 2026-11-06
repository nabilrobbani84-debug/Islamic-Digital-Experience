import { create } from "zustand";
import type { User, UserRole } from "@/types/domain";

export type AuthStatus = "loading" | "authenticated" | "offline-session" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: User | null;
  setAuthenticated: (user: User) => void;
  setOfflineSession: (user: User) => void;
  setUnauthenticated: () => void;
}

/** Status sesi di memori. Token tidak pernah disimpan di sini; sesi ada di cookie HttpOnly. */
export const useAuth = create<AuthState>()((set) => ({
  status: "loading",
  user: null,
  setAuthenticated: (user) => set({ status: "authenticated", user }),
  setOfflineSession: (user) => set({ status: "offline-session", user }),
  setUnauthenticated: () => set({ status: "unauthenticated", user: null }),
}));

const ROLE_RANK: Record<UserRole, number> = { USER: 0, ADMIN: 1, SUPER_ADMIN: 2 };

export type Permission =
  | "admin:access"
  | "admin:content"
  | "admin:datasets"
  | "admin:users:view"
  | "admin:users:manage-roles"
  | "admin:audit";

const PERMISSION_MIN_ROLE: Record<Permission, UserRole> = {
  "admin:access": "ADMIN",
  "admin:content": "ADMIN",
  "admin:datasets": "ADMIN",
  "admin:users:view": "ADMIN",
  "admin:users:manage-roles": "SUPER_ADMIN",
  "admin:audit": "ADMIN",
};

/** Pemeriksaan izin di UI hanya untuk pengalaman pengguna; otorisasi final tetap di backend. */
export function can(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[PERMISSION_MIN_ROLE[permission]];
}

export function hasRole(user: User | null, roles: readonly UserRole[]): boolean {
  return !!user && roles.includes(user.role);
}
