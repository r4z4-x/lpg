import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/endpoints';
import { formatMoney } from '@/lib/money';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { MoneyText } from '@/components/common/MoneyText';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Customer, Vendor } from '@/lib/api/types';

const receivableCols: Column<Customer>[] = [
  { header: 'Customer', cell: (c) => c.name },
  { header: 'Receivable', cell: (c) => <MoneyText minor={c.currentReceivableMinor} /> },
];
const payableCols: Column<Vendor>[] = [
  { header: 'Vendor', cell: (v) => v.name },
  { header: 'Payable', cell: (v) => <MoneyText minor={v.currentPayableMinor} /> },
];

export default function ReportsPage() {
  const [from, setFrom] = useState('0000-01-01');
  const [to, setTo] = useState('9999-12-31');

  const pnl = useQuery({ queryKey: ['pnl', from, to], queryFn: () => api.reports.pnl(from, to) });
  const worth = useQuery({ queryKey: ['businessWorth'], queryFn: () => api.reports.businessWorth() });
  const receivables = useQuery({ queryKey: ['receivables'], queryFn: () => api.reports.receivables() });
  const payables = useQuery({ queryKey: ['payables'], queryFn: () => api.reports.payables() });

  const p = pnl.data?.pnl;
  const w = worth.data?.businessWorth;

  return (
    <div className="space-y-8">
      <PageHeader title="Reports" />

      <section className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label>From</Label>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        </div>
        <h2 className="text-lg font-semibold">Profit &amp; loss</h2>
        {p ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard label="Revenue" value={formatMoney(p.revenueMinor)} />
            <KpiCard label="COGS" value={formatMoney(p.cogsMinor)} />
            <KpiCard label="Gross profit" value={formatMoney(p.grossProfitMinor)} />
            <KpiCard label="Operating expenses" value={formatMoney(p.operatingExpensesMinor)} />
            <KpiCard label="Net profit" value={formatMoney(p.netProfitMinor)} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Business worth</h2>
        {w ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Assets" value={formatMoney(w.assetsMinor)} />
              <KpiCard label="Liabilities" value={formatMoney(w.liabilitiesMinor)} />
              <KpiCard label="Net worth" value={formatMoney(w.businessWorthMinor)} />
              <KpiCard label="Equity (reconciled)" value={formatMoney(w.equityMinor)} sub={w.balanced ? 'Balanced ✓' : 'Out of balance!'} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                <div>Cash: <MoneyText minor={w.breakdown.assets.cash} /></div>
                <div>Payables: <MoneyText minor={w.breakdown.liabilities.payables} /></div>
                <div>Receivables: <MoneyText minor={w.breakdown.assets.receivables} /></div>
                <div>Cylinder deposits: <MoneyText minor={w.breakdown.liabilities.cylinderDeposits} /></div>
                <div>Gas inventory: <MoneyText minor={w.breakdown.assets.gasInventory} /></div>
                <div>Accrued expenses: <MoneyText minor={w.breakdown.liabilities.accruedExpenses} /></div>
                <div>Cylinder assets: <MoneyText minor={w.breakdown.assets.cylinderAssets} /></div>
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Receivables</h2>
          <DataTable
            columns={receivableCols}
            rows={receivables.data?.customers}
            rowKey={(c) => c._id}
            isLoading={receivables.isLoading}
            empty="None"
            getSearchText={(c) => c.name}
            searchPlaceholder="Search…"
            pageSize={8}
          />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Payables</h2>
          <DataTable
            columns={payableCols}
            rows={payables.data?.vendors}
            rowKey={(v) => v._id}
            isLoading={payables.isLoading}
            empty="None"
            getSearchText={(v) => v.name}
            searchPlaceholder="Search…"
            pageSize={8}
          />
        </div>
      </section>
    </div>
  );
}
