import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { MoneyText } from '@/components/common/MoneyText';
import { useToast } from '@/components/common/Toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/common/DataTable';
import type { PaymentAccount } from '@/lib/api/types';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const columns: Column<PaymentAccount>[] = [
  { header: 'Name', cell: (r) => r.name },
  { header: 'Type', cell: (r) => r.type },
  { header: 'Balance', cell: (r) => <MoneyText minor={r.currentBalanceMinor} /> },
];

export function PaymentAccountsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['paymentAccounts'], queryFn: () => api.setup.listPaymentAccounts() });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Cash');
  const [openingBalance, setOpeningBalance] = useState('');

  const create = useMutation({
    mutationFn: () => api.setup.createPaymentAccount({ name, type, openingBalance: openingBalance || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paymentAccounts'] });
      setName('');
      setOpeningBalance('');
      setOpen(false);
      toast('Payment account added', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Payment accounts</CardTitle>
        <Button variant="success" size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add account
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} rows={data?.paymentAccounts} rowKey={(r) => r._id} isLoading={isLoading} />
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add payment account">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
              <option value="Wallet">Wallet</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Opening balance</Label>
            <Input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => create.mutate()} disabled={create.isPending || !name}>
            Add
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
