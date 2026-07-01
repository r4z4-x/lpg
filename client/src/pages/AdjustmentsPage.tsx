import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { formatKgSub, formatDate } from '@/lib/format';
import { useToast } from '@/components/common/Toaster';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { MoneyText } from '@/components/common/MoneyText';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Adjustment } from '@/lib/api/types';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const columns: Column<Adjustment>[] = [
  { header: 'Date', cell: (a) => formatDate(a.createdAt) },
  { header: 'Type', cell: (a) => a.type },
  { header: 'Gas Δ (kg)', cell: (a) => formatKgSub(a.gasKgDeltaSub) },
  { header: 'Valuation impact', cell: (a) => <MoneyText minor={a.valuationImpactMinor} /> },
  { header: 'Reason', cell: (a) => a.reason },
];

export default function AdjustmentsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const adjustments = useQuery({ queryKey: ['adjustments'], queryFn: () => api.adjustments.list() });
  const types = useQuery({ queryKey: ['cylinderTypes'], queryFn: () => api.setup.listCylinderTypes() });

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'leakage' | 'damage' | 'correction'>('leakage');
  const [reason, setReason] = useState('');
  const [gasKg, setGasKg] = useState('');
  const [gasDirection, setGasDirection] = useState<'decrease' | 'increase'>('decrease');
  const [cylTypeId, setCylTypeId] = useState('');
  const [field, setField] = useState('filled');
  const [delta, setDelta] = useState('');

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { type, reason };
      if (gasKg) body.gas = { kg: gasKg, direction: gasDirection };
      if (cylTypeId && delta) body.cylinder = { cylinderTypeId: cylTypeId, deltas: { [field]: Number(delta) } };
      return api.adjustments.create(body);
    },
    onSuccess: () => {
      ['adjustments', 'gasInventory', 'cylinderInventory', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setReason('');
      setGasKg('');
      setDelta('');
      setOpen(false);
      toast('Adjustment recorded', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory adjustments">
        <Button variant="success" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New adjustment
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={adjustments.data?.adjustments}
        rowKey={(a) => a._id}
        isLoading={adjustments.isLoading}
        getSearchText={(a) => `${a.type} ${a.reason}`}
        searchPlaceholder="Search adjustments…"
        pageSize={10}
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="New inventory adjustment" className="max-w-2xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Type</Label>
              <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="leakage">Leakage</option>
                <option value="damage">Damage</option>
                <option value="correction">Correction</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Gas qty (kg, optional)</Label>
              <Input value={gasKg} onChange={(e) => setGasKg(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Gas direction</Label>
              <select className={selectClass} value={gasDirection} onChange={(e) => setGasDirection(e.target.value as typeof gasDirection)}>
                <option value="decrease">Decrease (loss)</option>
                <option value="increase">Increase (found)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Cylinder type (optional)</Label>
              <select className={selectClass} value={cylTypeId} onChange={(e) => setCylTypeId(e.target.value)}>
                <option value="">— none —</option>
                {types.data?.cylinderTypes.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Field</Label>
              <select className={selectClass} value={field} onChange={(e) => setField(e.target.value)}>
                <option value="filled">Filled</option>
                <option value="empty">Empty</option>
                <option value="customerHeld">At customers</option>
                <option value="lost">Lost</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Delta (e.g. -2)</Label>
              <Input value={delta} onChange={(e) => setDelta(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={() => create.mutate()} disabled={create.isPending || !reason || (!gasKg && !(cylTypeId && delta))}>
              Record adjustment
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
