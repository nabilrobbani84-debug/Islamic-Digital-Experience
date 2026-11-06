import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/misc";
import { api } from "@/services/api";
import { formatDateTime } from "@/lib/format";
import { AdminTable } from "../components/AdminTable";

export function AdminSourcesPage() {
  const sources = useQuery({ queryKey: ["admin", "sources"], queryFn: () => api.admin.contentSources() });
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">Sumber & lisensi</h2>
      <p className="mb-4 text-sm text-muted">Lisensi setiap dataset, kitab, audio, font, dan model 3D wajib diverifikasi sebelum didistribusikan.</p>
      <AdminTable
        query={sources}
        caption="Sumber konten"
        empty="Belum ada sumber konten terdaftar"
        rowKey={(s) => s.id}
        columns={[
          { header: "Sumber", cell: (s) => <><span className="font-medium">{s.name}</span><span className="block text-xs text-muted">{s.publisher ?? ""}</span></> },
          { header: "Lisensi", cell: (s) => s.license ?? "—" },
          { header: "Atribusi", cell: (s) => <span className="line-clamp-2 text-xs text-muted">{s.attribution ?? "—"}</span> },
          { header: "Verifikasi", cell: (s) => (s.licenseVerifiedAt ? <Badge tone="emerald">{formatDateTime(s.licenseVerifiedAt)}</Badge> : <Badge tone="warning">Belum diverifikasi</Badge>) },
        ]}
      />
    </div>
  );
}
