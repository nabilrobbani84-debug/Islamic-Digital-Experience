import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { PageLoader } from "@/components/feedback/RouteFallbacks";
import { PermissionDenied } from "@/components/feedback/States";
import { can, useAuth, type Permission } from "@/stores/auth";

/** Akun wajib: seluruh fitur aplikasi berada di balik guard ini. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === "loading") return <PageLoader />;
  if (status === "unauthenticated") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/** Halaman tamu (login/register) mengarahkan pengguna yang sudah masuk ke dashboard. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  if (status === "loading") return <PageLoader />;
  if (status === "authenticated" || status === "offline-session") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Pemeriksaan izin untuk pengalaman pengguna. Otorisasi final tetap dilakukan backend. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const user = useAuth((s) => s.user);
  if (!can(user, permission)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <PermissionDenied />
      </div>
    );
  }
  return <>{children}</>;
}
