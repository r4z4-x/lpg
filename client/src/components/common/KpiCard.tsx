import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Accent = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate';

const ACCENT: Record<Accent, string> = {
  blue: 'border-l-blue-500',
  green: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
  violet: 'border-l-violet-500',
  slate: 'border-l-slate-400',
};

export function KpiCard({
  label,
  value,
  sub,
  accent = 'slate',
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: Accent;
}) {
  const negative = value.trim().startsWith('-');
  return (
    <Card className={cn('border-l-4', ACCENT[accent])}>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn('mt-1 text-2xl font-semibold', negative && 'text-red-600')}>{value}</div>
        {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}
