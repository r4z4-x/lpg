import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { formatKgSub, formatDate } from '@/lib/format';
import { useToast } from '@/components/common/Toaster';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { MoneyText } from '@/components/common/MoneyText';
import { DateRangeFilter, inDateRange } from '@/components/common/DateRangeFilter';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Purchase } from '@/lib/api/types';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const columns: Column<Purchase>[] = [
  { header: '#', cell: (p) => p.purchaseNo },
  { header: 'Date', cell: (p) => formatDate(p.date) },
  { header: 'Qty (kg)', cell: (p) => formatKgSub(p.qtyKgSub) },
  { header: 'Rate/kg', cell: (p) => <MoneyText minor={p.ratePerKgMinor} /> },
  { header: 'Landed cost', cell: (p) => <MoneyText minor={p.landedCostMinor} /> },
  { header: 'Payment', cell: (p) => p.paymentType },
];

export default function PurchasesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const purchases = useQuery({ queryKey: ['purchases'], queryFn: () => api.purchases.list() });
  const vendors = useQuery({ queryKey: ['vendors'], queryFn: () => api.vendors.list() });
  const accounts = useQuery({ queryKey: ['paymentAccounts'], queryFn: () => api.setup.listPaymentAccounts() });

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const idemKey = useMemo(() => crypto.randomUUID(), [open]);

  const rows = (purchases.data?.purchases ?? []).filter((p) => inDateRange(p.date, from, to));

  const [vendorId, setVendorId] = useState('');
  const [qtyKg, setQtyKg] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [transport, setTransport] = useState('');
  const [misc, setMisc] = useState('');
  const [paymentType, setPaymentType] = useState('full');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.purchases.create(
        {
          vendorId,
          qtyKg,
          ratePerKg,
          transport: transport || undefined,
          misc: misc || undefined,
          paymentType,
          amountPaid: paymentType === 'partial' ? amountPaid : undefined,
          paymentAccountId: paymentType !== 'credit' ? paymentAccountId : undefined,
        },
        idemKey,
      ),
    onSuccess: () => {
      ['purchases', 'vendors', 'gasInventory', 'paymentAccounts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setQtyKg('');
      setRatePerKg('');
      setTransport('');
      setMisc('');
      setAmountPaid('');
      setOpen(false);
      toast('Purchase recorded', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Purchases">
        <Button variant="success" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New purchase
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p._id}
        isLoading={purchases.isLoading}
        getSearchText={(p) => `${p.purchaseNo} ${p.paymentType}`}
        searchPlaceholder="Search purchases…"
        filters={<DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />}
        pageSize={10}
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="New purchase" className="max-w-2xl">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Vendor</Label>
            <select className={selectClass} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">— select —</option>
              {vendors.data?.vendors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Quantity (kg)</Label>
            <Input value={qtyKg} onChange={(e) => setQtyKg(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Rate / kg</Label>
            <Input value={ratePerKg} onChange={(e) => setRatePerKg(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Transport</Label>
            <Input value={transport} onChange={(e) => setTransport(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Misc</Label>
            <Input value={misc} onChange={(e) => setMisc(e.target.value)} />
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
          {paymentType !== 'credit' && (
            <div className="space-y-1">
              <Label>Account</Label>
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
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => create.mutate()} disabled={create.isPending || !vendorId || !qtyKg || !ratePerKg}>
            Record purchase
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
