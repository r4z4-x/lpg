import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/common/Toaster';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { MoneyText } from '@/components/common/MoneyText';
import { DateRangeFilter, inDateRange } from '@/components/common/DateRangeFilter';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Expense } from '@/lib/api/types';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const columns: Column<Expense>[] = [
  { header: 'Date', cell: (e) => formatDate(e.date) },
  { header: 'Category', cell: (e) => e.category },
  { header: 'Amount', cell: (e) => <MoneyText minor={e.amountMinor} /> },
  { header: 'Paid', cell: (e) => (e.paid ? 'Yes' : 'Accrued') },
  { header: 'Note', cell: (e) => e.note ?? '—' },
];

export default function ExpensesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const expenses = useQuery({ queryKey: ['expenses'], queryFn: () => api.expenses.list() });
  const categories = useQuery({ queryKey: ['expenseCategories'], queryFn: () => api.expenses.listCategories() });
  const accounts = useQuery({ queryKey: ['paymentAccounts'], queryFn: () => api.setup.listPaymentAccounts() });

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const rows = (expenses.data?.expenses ?? []).filter((e) => inDateRange(e.date, from, to));
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [note, setNote] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.expenses.create(
        { category, amount, paymentAccountId: paymentAccountId || undefined, note: note || undefined },
        crypto.randomUUID(),
      ),
    onSuccess: () => {
      ['expenses', 'paymentAccounts', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setAmount('');
      setNote('');
      setOpen(false);
      toast('Expense recorded', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Expenses">
        <Button variant="success" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Record expense
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(e) => e._id}
        isLoading={expenses.isLoading}
        getSearchText={(e) => `${e.category} ${e.note ?? ''}`}
        searchPlaceholder="Search expenses…"
        filters={<DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />}
        pageSize={10}
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="Record expense" className="max-w-2xl">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Category</Label>
            <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— select —</option>
              {categories.data?.categories.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Account (blank = accrued)</Label>
            <select className={selectClass} value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
              <option value="">— accrued —</option>
              {accounts.data?.paymentAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => create.mutate()} disabled={create.isPending || !category || !amount}>
            Record expense
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
