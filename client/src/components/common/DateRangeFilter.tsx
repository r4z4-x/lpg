import { Input } from '@/components/ui/input';

export function DateRangeFilter({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="w-40" />
      <span className="text-sm text-muted-foreground">to</span>
      <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="w-40" />
    </div>
  );
}

/** True if `iso` (date or ISO string) falls within [from, to] (inclusive); blanks = open. */
export function inDateRange(iso: string, from: string, to: string): boolean {
  const day = iso ? iso.slice(0, 10) : '';
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
