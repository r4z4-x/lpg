import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/common/Toaster';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Holding } from '@/lib/api/types';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const refName = (v: Holding['customerId']): string => (typeof v === 'object' ? v.name : v);

const columns: Column<Holding>[] = [
  { header: 'Customer', cell: (h) => refName(h.customerId) },
  { header: 'Type', cell: (h) => refName(h.cylinderTypeId) },
  { header: 'Outstanding', cell: (h) => h.qty },
  { header: 'Issued', cell: (h) => h.issuedQty },
  { header: 'Issued on', cell: (h) => formatDate(h.issueDate) },
];

export default function CylindersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ['pendingCylinders'], queryFn: () => api.cylinders.pending() });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => api.customers.list() });
  const types = useQuery({ queryKey: ['cylinderTypes'], queryFn: () => api.setup.listCylinderTypes() });
  const accounts = useQuery({ queryKey: ['paymentAccounts'], queryFn: () => api.setup.listPaymentAccounts() });

  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [cylinderTypeId, setCylinderTypeId] = useState('');
  const [qty, setQty] = useState('1');
  const [condition, setCondition] = useState<'good' | 'damaged' | 'lost'>('good');
  const [refundDeposit, setRefundDeposit] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState('');

  const ret = useMutation({
    mutationFn: () =>
      api.cylinders.returnCylinders(
        {
          customerId,
          cylinderTypeId,
          qty: Number(qty) || 1,
          condition,
          refundDeposit: condition === 'good' ? refundDeposit : undefined,
          paymentAccountId: refundDeposit ? paymentAccountId : undefined,
        },
        crypto.randomUUID(),
      ),
    onSuccess: (res) => {
      ['pendingCylinders', 'customers', 'cylinderInventory', 'paymentAccounts', 'dashboard'].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
      setOpen(false);
      toast(`Returned ${res.returned} cylinder(s); refund ${(res.refundMinor / 100).toFixed(2)}`, 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Cylinders — pending returns">
        <Button variant="success" onClick={() => setOpen(true)}>
          <Undo2 className="mr-1.5 h-4 w-4" /> Return cylinders
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={pending.data?.pending}
        rowKey={(h) => h._id}
        isLoading={pending.isLoading}
        empty="No cylinders out"
        getSearchText={(h) => `${refName(h.customerId)} ${refName(h.cylinderTypeId)}`}
        searchPlaceholder="Search holdings…"
        pageSize={10}
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="Return cylinders" className="max-w-2xl">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Customer</Label>
            <select className={selectClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— select —</option>
              {customers.data?.customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Cylinder type</Label>
            <select className={selectClass} value={cylinderTypeId} onChange={(e) => setCylinderTypeId(e.target.value)}>
              <option value="">— select —</option>
              {types.data?.cylinderTypes.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Quantity</Label>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Condition</Label>
            <select className={selectClass} value={condition} onChange={(e) => setCondition(e.target.value as 'good' | 'damaged' | 'lost')}>
              <option value="good">Good</option>
              <option value="damaged">Damaged</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          {condition === 'good' && (
            <>
              <label className="flex items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={refundDeposit} onChange={(e) => setRefundDeposit(e.target.checked)} />
                Refund deposit
              </label>
              {refundDeposit && (
                <div className="space-y-1">
                  <Label>Refund account</Label>
                  <select className={selectClass} value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                    <option value="">— select —</option>
                    {accounts.data?.paymentAccounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={() => ret.mutate()}
            disabled={ret.isPending || !customerId || !cylinderTypeId || (refundDeposit && !paymentAccountId)}
          >
            Process return
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
