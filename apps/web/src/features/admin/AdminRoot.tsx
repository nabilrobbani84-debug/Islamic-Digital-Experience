import { NavLink, Navigate, Route, Routes } from "react-router";
import { Activity, Database, FileText, LayoutDashboard, RefreshCw, ScrollText, Users } from "lucide-react";
import { RequirePermission } from "@/features/auth/guards";
import { Badge } from "@/components/ui/misc";
import { useAuth } from "@/stores/auth";
import { cn } from "@/lib/cn";
import { AdminOverviewPage } from "./pages/AdminOverviewPage";
import { AdminContentPage } from "./pages/AdminContentPage";
import { AdminDatasetsPage } from "./pages/AdminDatasetsPage";
import { AdminSourcesPage } from "./pages/AdminSourcesPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminAuditPage } from "./pages/AdminAuditPage";
import { AdminSyncPage } from "./pages/AdminSyncPage";

const LINKS = [
  { to: "", label: "Ringkasan", icon: LayoutDashboard, end: true },
  { to: "content", label: "Konten & revisi", icon: FileText },
  { to: "datasets", label: "Dataset", icon: Database },
  { to: "sources", label: "Sumber & lisensi", icon: ScrollText },
  { to: "users", label: "Pengguna", icon: Users },
  { to: "audit", label: "Audit log", icon: Activity },
  { to: "sync", label: "Status sinkronisasi", icon: RefreshCw },
] as const;

/** Area admin terpisah. Izin dicek di UI untuk pengalaman pengguna; backend tetap memvalidasi setiap request. */
export default function AdminRoot() {
  const user = useAuth((s) => s.user);
  return (
    <RequirePermission permission="admin:access">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Admin NUR</h1>
        <Badge tone="gold">{user?.role}</Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Navigasi admin" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {LINKS.map((l) => (
              <li key={l.to} className="shrink-0">
                <NavLink
                  to={l.to === "" ? "/admin" : `/admin/${l.to}`}
                  end={"end" in l ? l.end : false}
                  className={({ isActive }) => cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap", isActive ? "bg-emerald-nur text-ivory" : "text-muted hover:bg-surface-2 hover:text-fg")}
                >
                  <l.icon className="size-4" aria-hidden /> {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <section className="min-w-0">
          <Routes>
            <Route index element={<AdminOverviewPage />} />
            <Route path="content" element={<AdminContentPage />} />
            <Route path="datasets" element={<AdminDatasetsPage />} />
            <Route path="sources" element={<AdminSourcesPage />} />
            <Route path="users" element={<RequirePermission permission="admin:users:view"><AdminUsersPage /></RequirePermission>} />
            <Route path="audit" element={<RequirePermission permission="admin:audit"><AdminAuditPage /></RequirePermission>} />
            <Route path="sync" element={<AdminSyncPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </section>
      </div>
    </RequirePermission>
  );
}
