import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ClipboardCheck } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { MoneyText } from '@/components/common/MoneyText';
import { useToast } from '@/components/common/Toaster';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export default function CashPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ['paymentAccounts'], queryFn: () => api.setup.listPaymentAccounts() });

  const [mvOpen, setMvOpen] = useState(false);
  const [clOpen, setClOpen] = useState(false);

  const [mvAccount, setMvAccount] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [mvAmount, setMvAmount] = useState('');
  const [mvNote, setMvNote] = useState('');

  const [clAccount, setClAccount] = useState('');
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().slice(0, 10));
  const [actualCash, setActualCash] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['paymentAccounts'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const movement = useMutation({
    mutationFn: () =>
      api.cash.movement({ paymentAccountId: mvAccount, direction, amount: mvAmount, note: mvNote || undefined }),
    onSuccess: () => {
      refresh();
      setMvAmount('');
      setMvNote('');
      setMvOpen(false);
      toast('Cash movement recorded', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  const close = useMutation({
    mutationFn: () => api.cash.closeDay({ paymentAccountId: clAccount, businessDate, actualCash }),
    onSuccess: () => {
      refresh();
      setActualCash('');
      setClOpen(false);
      toast('Day closed', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Cash management">
        <Button variant="outline" onClick={() => setMvOpen(true)}>
          <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Cash movement
        </Button>
        <Button variant="success" onClick={() => setClOpen(true)}>
          <ClipboardCheck className="mr-1.5 h-4 w-4" /> Daily closing
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {accounts.data?.paymentAccounts.map((a) => (
          <Card key={a._id} className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">{a.name}</div>
              <div className="mt-1 text-xl font-semibold">
                <MoneyText minor={a.currentBalanceMinor} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={mvOpen} onClose={() => setMvOpen(false)} title="Cash movement">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Account</Label>
            <select className={selectClass} value={mvAccount} onChange={(e) => setMvAccount(e.target.value)}>
              <option value="">— select —</option>
              {accounts.data?.paymentAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Direction</Label>
            <select className={selectClass} value={direction} onChange={(e) => setDirection(e.target.value as 'in' | 'out')}>
              <option value="in">In (capital)</option>
              <option value="out">Out (drawings)</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input value={mvAmount} onChange={(e) => setMvAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Note</Label>
            <Input value={mvNote} onChange={(e) => setMvNote(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setMvOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => movement.mutate()} disabled={movement.isPending || !mvAccount || !mvAmount}>
            Record movement
          </Button>
        </div>
      </Dialog>

      <Dialog open={clOpen} onClose={() => setClOpen(false)} title="Daily cash closing">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Account</Label>
            <select className={selectClass} value={clAccount} onChange={(e) => setClAccount(e.target.value)}>
              <option value="">— select —</option>
              {accounts.data?.paymentAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Business date</Label>
            <Input value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Counted cash</Label>
            <Input value={actualCash} onChange={(e) => setActualCash(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setClOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => close.mutate()} disabled={close.isPending || !clAccount || !actualCash}>
            Close day
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
