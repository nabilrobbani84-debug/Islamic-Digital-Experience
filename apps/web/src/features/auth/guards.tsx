import type { ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";
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

/** Hanya izinkan redirect internal (mencegah open redirect). */
export function safeNext(next: string | null): string {
  if (!next) return "/dashboard";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

/**
 * Halaman tamu (login/register). Setelah pengguna masuk, guard ini satu-satunya yang
 * melakukan redirect (ke `?next=` atau dashboard) agar tidak ada dua navigasi yang berlomba.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const [params] = useSearchParams();
  if (status === "loading") return <PageLoader />;
  if (status === "authenticated" || status === "offline-session") return <Navigate to={safeNext(params.get("next"))} replace />;
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
