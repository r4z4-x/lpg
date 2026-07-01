import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import type { CylinderInventoryRow } from '@/lib/api/types';

function typeName(row: CylinderInventoryRow): string {
  return typeof row.cylinderTypeId === 'object' ? row.cylinderTypeId.name : row.cylinderTypeId;
}

const columns: Column<CylinderInventoryRow>[] = [
  { header: 'Type', cell: typeName },
  { header: 'Filled', cell: (r) => r.filled },
  { header: 'Empty', cell: (r) => r.empty },
  { header: 'At customers', cell: (r) => r.customerHeld },
  { header: 'Lost', cell: (r) => r.lost },
  { header: 'Damaged', cell: (r) => r.damaged },
];

export default function InventoryPage() {
  const gas = useQuery({ queryKey: ['gasInventory'], queryFn: () => api.inventory.gas() });
  const cylinders = useQuery({
    queryKey: ['cylinderInventory'],
    queryFn: () => api.inventory.cylinders(),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Gas available (kg)" value={gas.data?.gas.availableKg ?? '—'} />
        <KpiCard label="Weighted avg cost" value={gas.data?.gas.weightedAvgCost ?? '—'} />
        <KpiCard label="Inventory value" value={gas.data?.gas.inventoryValue ?? '—'} />
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Cylinders</h2>
        <DataTable
          columns={columns}
          rows={cylinders.data?.cylinders}
          rowKey={(r) => r._id}
          isLoading={cylinders.isLoading}
          empty="No cylinder stock yet"
          getSearchText={typeName}
          searchPlaceholder="Search types…"
          pageSize={10}
        />
      </div>
    </div>
  );
}
