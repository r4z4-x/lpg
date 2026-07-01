import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { formatKgSub } from '@/lib/format';
import { MoneyText } from '@/components/common/MoneyText';
import { useToast } from '@/components/common/Toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/common/DataTable';
import type { CylinderType } from '@/lib/api/types';

const columns: Column<CylinderType>[] = [
  { header: 'Name', cell: (r) => r.name },
  { header: 'Capacity (kg)', cell: (r) => formatKgSub(r.capacityKgSub) },
  { header: 'Tare (kg)', cell: (r) => formatKgSub(r.tareKgSub) },
  { header: 'Deposit', cell: (r) => (r.depositAmountMinor != null ? <MoneyText minor={r.depositAmountMinor} /> : '—') },
  { header: 'Active', cell: (r) => (r.isActive ? 'Yes' : 'No') },
];

export function CylinderTypesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['cylinderTypes'], queryFn: () => api.setup.listCylinderTypes() });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [capacityKg, setCapacityKg] = useState('');
  const [tareKg, setTareKg] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.setup.createCylinderType({
        name,
        capacityKg,
        tareKg: tareKg || undefined,
        depositAmount: depositAmount || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cylinderTypes'] });
      setName('');
      setCapacityKg('');
      setTareKg('');
      setDepositAmount('');
      setOpen(false);
      toast('Cylinder type added', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Cylinder types</CardTitle>
        <Button variant="success" size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add type
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} rows={data?.cylinderTypes} rowKey={(r) => r._id} isLoading={isLoading} />
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add cylinder type">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Capacity kg</Label>
            <Input value={capacityKg} onChange={(e) => setCapacityKg(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Tare kg</Label>
            <Input value={tareKg} onChange={(e) => setTareKg(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Deposit (optional)</Label>
            <Input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => create.mutate()} disabled={create.isPending || !name || !capacityKg}>
            Add
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
