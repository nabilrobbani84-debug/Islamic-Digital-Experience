import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { formatDateTime } from "@/lib/format";
import { AdminTable } from "../components/AdminTable";

export function AdminAuditPage() {
  const logs = useQuery({ queryKey: ["admin", "audit"], queryFn: () => api.admin.auditLogs() });
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">Audit log</h2>
      <p className="mb-4 text-sm text-muted">Catatan append-only tindakan admin.</p>
      <AdminTable
        query={logs}
        caption="Audit log"
        empty="Belum ada tindakan admin tercatat"
        rowKey={(l) => l.id}
        columns={[
          { header: "Waktu", cell: (l) => formatDateTime(l.createdAt) },
          { header: "Aktor", cell: (l) => l.actorName },
          { header: "Aksi", cell: (l) => <code className="text-xs">{l.action}</code> },
          { header: "Entitas", cell: (l) => <>{l.entityType}<span className="block text-xs text-muted">{l.entityId ?? ""}</span></> },
        ]}
      />
    </div>
  );
}
