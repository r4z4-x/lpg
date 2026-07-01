import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  if (isError || !data) return <p className="text-sm text-destructive">Failed to load dashboard.</p>;

  const d = data.dashboard;
  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Gas stock (kg)" value={d.gas.availableKg} sub={`WAC ${d.gas.weightedAvgCost}`} accent="blue" />
        <KpiCard label="Inventory value" value={d.gas.inventoryValue} accent="blue" />
        <KpiCard label="Cash in hand" value={d.cashInHand} accent="green" />
        <KpiCard label="Receivables / Payables" value={d.receivables} sub={`Payables ${d.payables}`} accent="amber" />
        <KpiCard label="Today sales" value={d.todaySales} sub={`Month ${d.monthSales}`} accent="violet" />
        <KpiCard label="Today expenses" value={d.todayExpenses} sub={`Month ${d.monthExpenses}`} accent="red" />
        <KpiCard label="Gross profit (MTD)" value={d.grossProfitMTD} accent="green" />
        <KpiCard label="Net profit (MTD)" value={d.netProfitMTD} accent="green" />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Cylinders</h2>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Filled" value={String(d.cylinders.filled)} />
        <KpiCard label="Empty" value={String(d.cylinders.empty)} />
        <KpiCard label="At customers" value={String(d.cylinders.customerHeld)} />
        <KpiCard label="Lost" value={String(d.cylinders.lost)} />
        <KpiCard label="Damaged" value={String(d.cylinders.damaged)} />
      </div>
    </div>
  );
}
