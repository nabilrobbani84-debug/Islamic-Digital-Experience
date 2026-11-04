import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/feedback/States";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** Tabel admin generik dengan state loading/error/empty dan scroll horizontal di layar sempit. */
export function AdminTable<T>({ query, columns, rowKey, empty, caption }: { query: UseQueryResult<T[]>; columns: Column<T>[]; rowKey: (row: T) => string; empty: string; caption: string }) {
  if (query.isPending) return <ListSkeleton rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) return <EmptyState icon={<Inbox className="size-6" />} title={empty} />;
  return (
    <div className="nur-surface overflow-x-auto rounded-3xl" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {columns.map((c) => (
              <th key={c.header} scope="col" className="px-4 py-3 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {query.data.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-0">
              {columns.map((c) => (
                <td key={c.header} className={c.className ?? "px-4 py-3 align-top"}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
