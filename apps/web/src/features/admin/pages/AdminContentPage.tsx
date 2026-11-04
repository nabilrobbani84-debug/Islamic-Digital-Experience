import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/misc";
import { api, userMessage } from "@/services/api";
import { toast } from "@/stores/ui";
import { formatDateTime } from "@/lib/format";
import type { ContentRevision, ContentStatus, RevisionEntityType } from "@/types/domain";
import { AdminTable } from "../components/AdminTable";

const ENTITY_LABELS: Record<RevisionEntityType, string> = {
  VERSE_TRANSLATION: "Terjemahan ayat",
  TAFSIR_CONTENT: "Tafsir",
  DAILY_DUA: "Doa harian",
  HADITH: "Hadis",
  ASMAUL_HUSNA: "Asmaul Husna",
  DHIKR_ITEM: "Dzikir",
  AUDIO_ASSET: "Metadata audio",
  CONTENT_SOURCE: "Sumber konten",
};

export const STATUS_TONE: Record<ContentStatus, "neutral" | "gold" | "emerald" | "warning"> = {
  DRAFT: "neutral",
  REVIEW: "gold",
  PUBLISHED: "emerald",
  ARCHIVED: "warning",
};

function CreateRevisionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const [entityType, setEntityType] = useState<RevisionEntityType>("DAILY_DUA");
  const [action, setAction] = useState<"CREATE" | "UPDATE" | "DELETE">("UPDATE");
  const [entityId, setEntityId] = useState("");
  const [payload, setPayload] = useState("{\n  \n}");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: api.admin.createRevision,
    onSuccess: () => {
      toast.success("Revisi diajukan untuk review");
      void client.invalidateQueries({ queryKey: ["admin", "revisions"] });
      onClose();
    },
    onError: (err) => setError(userMessage(err)),
  });

  const submit = (): void => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setError("Payload harus JSON yang valid.");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setError("Payload harus berupa objek JSON.");
      return;
    }
    if (action !== "CREATE" && !entityId.trim()) {
      setError("ID entitas wajib untuk UPDATE/DELETE.");
      return;
    }
    create.mutate({ entityType, action, entityId: action === "CREATE" ? null : entityId.trim(), payload: parsed as Record<string, unknown> });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ajukan revisi konten"
      description="Revisi masuk antrean review dan baru terbit setelah disetujui reviewer lain."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={submit} loading={create.isPending}>Ajukan</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Jenis konten" value={entityType} onChange={(e) => setEntityType(e.target.value as RevisionEntityType)}>
          {(Object.keys(ENTITY_LABELS) as RevisionEntityType[]).map((k) => <option key={k} value={k}>{ENTITY_LABELS[k]}</option>)}
        </Select>
        <Select label="Aksi" value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
          <option value="CREATE">Tambah</option>
          <option value="UPDATE">Ubah</option>
          <option value="DELETE">Hapus</option>
        </Select>
        {action !== "CREATE" && (
          <div className="sm:col-span-2">
            <Input label="ID entitas" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Textarea label="Payload (JSON)" value={payload} onChange={(e) => setPayload(e.target.value)} className="min-h-48 font-mono text-xs" hint="Sertakan sumber/referensi untuk konten keagamaan." spellCheck={false} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
    </Dialog>
  );
}

export function AdminContentPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<ContentRevision | null>(null);
  const revisions = useQuery({ queryKey: ["admin", "revisions"], queryFn: () => api.admin.revisions() });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "APPROVE" | "REJECT" }) => api.admin.reviewRevision(id, decision),
    onSuccess: (r) => {
      toast.success(r.status === "PUBLISHED" ? "Revisi diterbitkan" : "Revisi dikembalikan ke draft");
      void client.invalidateQueries({ queryKey: ["admin"] });
      setViewing(null);
    },
    onError: (err) => toast.error("Review gagal", userMessage(err)),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Konten & revisi</h2>
          <p className="text-sm text-muted">Terjemahan, tafsir, doa, hadis, Asmaul Husna, dzikir, dan metadata audio.</p>
        </div>
        <Button leftIcon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Revisi baru</Button>
      </div>
      <AdminTable
        query={revisions}
        caption="Daftar revisi konten"
        empty="Belum ada revisi"
        rowKey={(r) => r.id}
        columns={[
          { header: "Konten", cell: (r) => <><span className="font-medium">{ENTITY_LABELS[r.entityType]}</span><span className="block text-xs text-muted">{r.entityId ?? "baru"}</span></> },
          { header: "Aksi", cell: (r) => r.action },
          { header: "Status", cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
          { header: "Penulis", cell: (r) => <>{r.authorName}<span className="block text-xs text-muted">{formatDateTime(r.createdAt)}</span></> },
          { header: "", cell: (r) => <Button size="sm" variant="outline" onClick={() => setViewing(r)}>Tinjau</Button> },
        ]}
      />
      <CreateRevisionDialog open={open} onClose={() => setOpen(false)} />
      <Dialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Tinjau revisi"
        size="lg"
        footer={
          viewing?.status === "REVIEW" && (
            <>
              <Button variant="ghost" onClick={() => viewing && review.mutate({ id: viewing.id, decision: "REJECT" })} loading={review.isPending}>Tolak</Button>
              <Button onClick={() => viewing && review.mutate({ id: viewing.id, decision: "APPROVE" })} loading={review.isPending}>Setujui & terbitkan</Button>
            </>
          )
        }
      >
        {viewing && (
          <div className="space-y-3 text-sm">
            <p><span className="text-muted">Konten:</span> {ENTITY_LABELS[viewing.entityType]} · {viewing.action}</p>
            <p><span className="text-muted">Penulis:</span> {viewing.authorName}</p>
            {viewing.reviewerName && <p><span className="text-muted">Reviewer:</span> {viewing.reviewerName}</p>}
            <pre className="max-h-80 overflow-auto rounded-2xl bg-surface-2 p-4 text-xs">{JSON.stringify(viewing.payload, null, 2)}</pre>
            <p className="text-xs text-muted">Reviewer harus berbeda dari penulis. Backend menolak persetujuan oleh penulis sendiri.</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
