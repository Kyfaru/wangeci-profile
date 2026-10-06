import Link from "next/link";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

/**
 * One reusable table with SERVER-SIDE paging: the page only ever receives one page of rows (the query
 * used `skip` and `take`), and the buttons are plain links carrying `?page=`. Used for orders, customers,
 * the audit log and later comments.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  page,
  pageSize,
  total,
  hrefForPage,
  empty = "Nothing to show.",
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  /** Builds the link for a page number, keeping the other filters (for example `?status=PAID`). */
  hrefForPage: (page: number) => string;
  empty?: string;
  caption: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-black/10 bg-cream/60 text-xs uppercase tracking-wide text-black/60">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-3 font-medium ${c.className ?? ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-black/50">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-cream/40">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-top text-black ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Pages" className="mt-3 flex items-center justify-between text-sm text-black/60">
        <span>
          {first} to {last} of {total}
        </span>
        <span className="flex gap-2">
          {page > 1 ? (
            <Link href={hrefForPage(page - 1)} className="rounded-full border border-black/20 px-4 py-1.5 hover:border-navy">
              Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={hrefForPage(page + 1)} className="rounded-full border border-black/20 px-4 py-1.5 hover:border-navy">
              Next
            </Link>
          ) : null}
        </span>
      </nav>
    </div>
  );
}

/** Reads `?page=` safely: a whole number from 1 up. */
export const pageFrom = (value: string | string[] | undefined) => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
};
