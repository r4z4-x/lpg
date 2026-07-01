import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Amount display with sign-based coloring used consistently across the app:
 *   negative → red · positive → emerald · zero → muted.
 */
export function MoneyText({
  minor,
  currency,
  className,
}: {
  minor: number;
  currency?: string;
  className?: string;
}) {
  const color = minor < 0 ? 'text-red-600' : minor > 0 ? 'text-emerald-700' : 'text-muted-foreground';
  return <span className={cn('tabular-nums font-medium', color, className)}>{formatMoney(minor, currency)}</span>;
}
