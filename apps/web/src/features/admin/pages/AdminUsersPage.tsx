import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/misc";
import { api, userMessage } from "@/services/api";
import { can, useAuth } from "@/stores/auth";
import { toast } from "@/stores/ui";
import { formatDateTime } from "@/lib/format";
import type { UserRole } from "@/types/domain";
import { AdminTable } from "../components/AdminTable";

const ROLES: UserRole[] = ["USER", "ADMIN", "SUPER_ADMIN"];

export function AdminUsersPage() {
  const me = useAuth((s) => s.user);
  const client = useQueryClient();
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => api.admin.users() });
  const canManageRoles = can(me, "admin:users:manage-roles");
  const onDone = (message: string) => () => {
    toast.success(message);
    void client.invalidateQueries({ queryKey: ["admin", "users"] });
  };
  const role = useMutation({ mutationFn: ({ id, role: r }: { id: string; role: UserRole }) => api.admin.updateUserRole(id, r), onSuccess: onDone("Peran diperbarui"), onError: (e) => toast.error("Gagal", userMessage(e)) });
  const active = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.admin.setUserActive(id, isActive), onSuccess: onDone("Status akun diperbarui"), onError: (e) => toast.error("Gagal", userMessage(e)) });

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">Pengguna</h2>
      <p className="mb-4 text-sm text-muted">{canManageRoles ? "Super Admin dapat mengubah peran. Semua tindakan tercatat di audit log." : "Hanya Super Admin yang dapat mengubah peran pengguna."}</p>
      <AdminTable
        query={users}
        caption="Daftar pengguna"
        empty="Belum ada pengguna"
        rowKey={(u) => u.id}
        columns={[
          { header: "Pengguna", cell: (u) => <><span className="font-medium">{u.name}</span><span className="block text-xs text-muted">{u.email}</span></> },
          {
            header: "Peran",
            cell: (u) =>
              canManageRoles && u.id !== me?.id ? (
                <select aria-label={`Peran ${u.name}`} value={u.role} onChange={(e) => role.mutate({ id: u.id, role: e.target.value as UserRole })} className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <Badge tone={u.role === "USER" ? "neutral" : "gold"}>{u.role}</Badge>
              ),
          },
          { header: "Status", cell: (u) => <Badge tone={u.isActive ? "emerald" : "danger"}>{u.isActive ? "Aktif" : "Nonaktif"}</Badge> },
          { header: "Terdaftar", cell: (u) => formatDateTime(u.createdAt) },
          {
            header: "",
            cell: (u) =>
              u.id !== me?.id && (
                <Button size="sm" variant="outline" onClick={() => active.mutate({ id: u.id, isActive: !u.isActive })}>
                  {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              ),
          },
        ]}
      />
    </div>
  );
}
