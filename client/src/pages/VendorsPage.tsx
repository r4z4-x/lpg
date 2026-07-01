import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet } from 'lucide-react';
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
import type { Vendor } from '@/lib/api/types';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export default function VendorsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const vendors = useQuery({ queryKey: ['vendors'], queryFn: () => api.vendors.list() });
  const accounts = useQuery({ queryKey: ['paymentAccounts'], queryFn: () => api.setup.listPaymentAccounts() });

  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  const [payVendorId, setPayVendorId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vendors'] });

  const create = useMutation({
    mutationFn: () => api.vendors.create({ name, contact: contact || undefined, openingBalance: openingBalance || undefined }),
    onSuccess: () => {
      invalidate();
      setName('');
      setContact('');
      setOpeningBalance('');
      setAddOpen(false);
      toast('Vendor added', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  const pay = useMutation({
    mutationFn: () => api.vendors.pay(payVendorId, { amount: payAmount, paymentAccountId: payAccountId }, crypto.randomUUID()),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['paymentAccounts'] });
      setPayAmount('');
      setPayOpen(false);
      toast('Payment recorded', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  const columns: Column<Vendor>[] = [
    { header: 'Name', cell: (v) => v.name },
    { header: 'Contact', cell: (v) => v.contact ?? '—' },
    { header: 'Payable', cell: (v) => <MoneyText minor={v.currentPayableMinor} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Vendors">
        <Button variant="outline" onClick={() => setPayOpen(true)}>
          <Wallet className="mr-1.5 h-4 w-4" /> Record payment
        </Button>
        <Button variant="success" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add vendor
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={vendors.data?.vendors}
        rowKey={(v) => v._id}
        isLoading={vendors.isLoading}
        getSearchText={(v) => `${v.name} ${v.contact ?? ''}`}
        searchPlaceholder="Search vendors…"
        pageSize={10}
      />

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add vendor">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Contact</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Opening payable</Label>
            <Input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setAddOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => create.mutate()} disabled={create.isPending || !name}>
            Add vendor
          </Button>
        </div>
      </Dialog>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} title="Record vendor payment">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Vendor</Label>
            <select className={selectClass} value={payVendorId} onChange={(e) => setPayVendorId(e.target.value)}>
              <option value="">— select —</option>
              {vendors.data?.vendors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Account</Label>
            <select className={selectClass} value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)}>
              <option value="">— select —</option>
              {accounts.data?.paymentAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Amount</Label>
            <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPayOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => pay.mutate()} disabled={pay.isPending || !payVendorId || !payAccountId || !payAmount}>
            Pay vendor
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
