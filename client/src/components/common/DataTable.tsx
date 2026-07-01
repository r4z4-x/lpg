import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  empty?: string;
  /** Provide to enable a search box; returns the searchable text for a row. */
  getSearchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra filter controls rendered in the toolbar (e.g. date range, status select). */
  filters?: ReactNode;
  /** Rows per page; when set and the result exceeds it, a pager is shown. */
  pageSize?: number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  empty = 'No records',
  getSearchText,
  searchPlaceholder = 'Search…',
  filters,
  pageSize,
}: DataTableProps<T>) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const all = rows ?? [];
    if (!getSearchText || !q.trim()) return all;
    const needle = q.trim().toLowerCase();
    return all.filter((r) => getSearchText(r).toLowerCase().includes(needle));
  }, [rows, q, getSearchText]);

  // Reset to the first page when the filter result changes.
  useEffect(() => {
    setPage(1);
  }, [q, rows]);

  const total = filtered.length;
  const totalPages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const current = Math.min(page, totalPages);
  const paged = pageSize ? filtered.slice((current - 1) * pageSize, current * pageSize) : filtered;

  const showToolbar = Boolean(getSearchText || filters);

  return (
    <div className="space-y-2">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {getSearchText && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-64 pl-8"
              />
            </div>
          )}
          {filters}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <THead>
            <TR>
              {columns.map((c) => (
                <TH key={c.header} className={c.className}>
                  {c.header}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {isLoading ? (
              <TR>
                <TD className="text-muted-foreground" {...{ colSpan: columns.length }}>
                  Loading…
                </TD>
              </TR>
            ) : paged.length === 0 ? (
              <TR>
                <TD className="text-muted-foreground" {...{ colSpan: columns.length }}>
                  {empty}
                </TD>
              </TR>
            ) : (
              paged.map((row) => (
                <TR key={rowKey(row)}>
                  {columns.map((c) => (
                    <TD key={c.header} className={c.className}>
                      {c.cell(row)}
                    </TD>
                  ))}
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>

      {pageSize && total > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <span>
              Page {current} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
