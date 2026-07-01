import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { formatKgSub } from '@/lib/format';
import { useAuth } from '@/lib/auth/useAuth';
import { useToast } from '@/components/common/Toaster';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { MoneyText } from '@/components/common/MoneyText';
import { DateRangeFilter, inDateRange } from '@/components/common/DateRangeFilter';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Sale } from '@/lib/api/types';

interface ChargeRow {
  name: string;
  amount: string;
}

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export default function SalesPage() {
  const { isOwner } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const sales = useQuery({ queryKey: ['sales'], queryFn: () => api.sales.list() });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => api.customers.list() });
  const types = useQuery({ queryKey: ['cylinderTypes'], queryFn: () => api.setup.listCylinderTypes() });
  const accounts = useQuery({ queryKey: ['paymentAccounts'], queryFn: () => api.setup.listPaymentAccounts() });

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const [customerId, setCustomerId] = useState('');
  const [customerType, setCustomerType] = useState<'exchange' | 'no_cylinder'>('exchange');
  const [cylinderTypeId, setCylinderTypeId] = useState('');
  const [cylinderCount, setCylinderCount] = useState('1');
  const [qtyKg, setQtyKg] = useState('');
  const [saleRate, setSaleRate] = useState('');
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [discount, setDiscount] = useState('');
  const [paymentType, setPaymentType] = useState('full');
  const [amountPaid, setAmountPaid] = useState('');
  const [previousBalanceRecovery, setPreviousBalanceRecovery] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [collectDeposit, setCollectDeposit] = useState(false);

  const gas = (parseFloat(qtyKg) || 0) * (parseFloat(saleRate) || 0);
  const chargeSum = charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const invoicePreview = gas + chargeSum - (parseFloat(discount) || 0);

  const create = useMutation({
    mutationFn: () =>
      api.sales.create(
        {
          customerId,
          customerType,
          cylinderTypeId,
          cylinderCount: Number(cylinderCount) || 1,
          qtyKg,
          saleRate,
          charges: charges.filter((c) => c.name && c.amount),
          discount: discount || undefined,
          paymentType,
          amountPaid: paymentType === 'partial' ? amountPaid : undefined,
          previousBalanceRecovery: previousBalanceRecovery || undefined,
          paymentAccountId: paymentAccountId || undefined,
          collectDeposit: customerType === 'no_cylinder' ? collectDeposit : undefined,
        },
        idemKey,
      ),
    onSuccess: () => {
      ['sales', 'customers', 'gasInventory', 'cylinderInventory', 'paymentAccounts', 'dashboard'].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
      setQtyKg('');
      setSaleRate('');
      setCharges([]);
      setDiscount('');
      setAmountPaid('');
      setPreviousBalanceRecovery('');
      setIdemKey(crypto.randomUUID());
      setOpen(false);
      toast('Sale recorded', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  const columns: Column<Sale>[] = [
    { header: '#', cell: (s) => s.invoiceNo },
    { header: 'Type', cell: (s) => (s.customerType === 'exchange' ? 'Exchange' : 'No-cylinder') },
    { header: 'Qty (kg)', cell: (s) => formatKgSub(s.qtyKgSub) },
    { header: 'Invoice', cell: (s) => <MoneyText minor={s.invoiceAmountMinor} /> },
    { header: 'Recovery', cell: (s) => <MoneyText minor={s.previousBalanceRecoveryMinor} /> },
    { header: 'Payment', cell: (s) => s.paymentType },
    ...(isOwner
      ? [{ header: 'COGS', cell: (s: Sale) => (s.cogsMinor != null ? <MoneyText minor={s.cogsMinor} /> : '—') }]
      : []),
  ];

  const rows = (sales.data?.sales ?? []).filter((s) => inDateRange(s.date, from, to));

  return (
    <div className="space-y-6">
      <PageHeader title="Sales">
        <Button variant="success" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New sale
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s._id}
        isLoading={sales.isLoading}
        empty="No sales yet"
        getSearchText={(s) => `${s.invoiceNo} ${s.customerType} ${s.paymentType}`}
        searchPlaceholder="Search sales…"
        filters={<DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />}
        pageSize={10}
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="New sale" className="max-w-3xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
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
              <Label>Customer type</Label>
              <select
                className={selectClass}
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as 'exchange' | 'no_cylinder')}
              >
                <option value="exchange">Exchange (brings empty)</option>
                <option value="no_cylinder">No cylinder (issue company)</option>
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
              <Label>Cylinder count</Label>
              <Input value={cylinderCount} onChange={(e) => setCylinderCount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Gas qty (kg)</Label>
              <Input value={qtyKg} onChange={(e) => setQtyKg(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sale rate / kg</Label>
              <Input value={saleRate} onChange={(e) => setSaleRate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Revenue charges</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setCharges((c) => [...c, { name: '', amount: '' }])}>
                Add charge
              </Button>
            </div>
            {charges.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  placeholder="e.g. Delivery"
                  value={row.name}
                  onChange={(e) => setCharges((c) => c.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                />
                <Input
                  placeholder="Amount"
                  value={row.amount}
                  onChange={(e) => setCharges((c) => c.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setCharges((c) => c.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Discount</Label>
              <Input value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Payment</Label>
              <select className={selectClass} value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                <option value="full">Full</option>
                <option value="partial">Partial</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            {paymentType === 'partial' && (
              <div className="space-y-1">
                <Label>Amount paid</Label>
                <Input value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Previous balance recovery</Label>
              <Input value={previousBalanceRecovery} onChange={(e) => setPreviousBalanceRecovery(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Separate from the invoice — reduces old balance, not revenue.</p>
            </div>
            <div className="space-y-1">
              <Label>Payment account</Label>
              <select className={selectClass} value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                <option value="">— none —</option>
                {accounts.data?.paymentAccounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            {customerType === 'no_cylinder' && (
              <label className="flex items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={collectDeposit} onChange={(e) => setCollectDeposit(e.target.checked)} />
                Collect cylinder deposit
              </label>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md bg-blue-50 px-4 py-3">
            <span className="text-sm text-blue-700">Invoice preview</span>
            <span className="text-lg font-semibold text-blue-800">{invoicePreview.toFixed(2)}</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => create.mutate()}
              disabled={create.isPending || !customerId || !cylinderTypeId || !qtyKg || !saleRate}
            >
              {create.isPending ? 'Recording…' : 'Record sale'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
