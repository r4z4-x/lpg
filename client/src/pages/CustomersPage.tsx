import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { useToast } from '@/components/common/Toaster';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { MoneyText } from '@/components/common/MoneyText';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Customer } from '@/lib/api/types';

const columns: Column<Customer>[] = [
  { header: 'Name', cell: (c) => c.name },
  { header: 'Contact', cell: (c) => c.contact ?? '—' },
  { header: 'Receivable', cell: (c) => <MoneyText minor={c.currentReceivableMinor} /> },
  { header: 'Credit limit', cell: (c) => (c.creditLimitMinor ? <MoneyText minor={c.creditLimitMinor} /> : '—') },
  { header: 'Cylinders held', cell: (c) => c.heldCylinders },
];

export default function CustomersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => api.customers.list() });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [openingReceivable, setOpeningReceivable] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [cylinderLimit, setCylinderLimit] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.customers.create({
        name,
        contact: contact || undefined,
        openingReceivable: openingReceivable || undefined,
        creditLimit: creditLimit || undefined,
        cylinderLimit: cylinderLimit ? Number(cylinderLimit) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      setName('');
      setContact('');
      setOpeningReceivable('');
      setCreditLimit('');
      setCylinderLimit('');
      setOpen(false);
      toast('Customer added', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Customers">
        <Button variant="success" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add customer
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={customers.data?.customers}
        rowKey={(c) => c._id}
        isLoading={customers.isLoading}
        getSearchText={(c) => `${c.name} ${c.contact ?? ''}`}
        searchPlaceholder="Search customers…"
        pageSize={10}
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="Add customer">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Contact</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Opening receivable</Label>
            <Input value={openingReceivable} onChange={(e) => setOpeningReceivable(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Credit limit (0 = none)</Label>
            <Input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cylinder limit (0 = none)</Label>
            <Input value={cylinderLimit} onChange={(e) => setCylinderLimit(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => create.mutate()} disabled={create.isPending || !name}>
            Add customer
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
