import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { useToast } from '@/components/common/Toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function OpeningBalancesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.setup.getSettings() });
  const accounts = useQuery({ queryKey: ['paymentAccounts'], queryFn: () => api.setup.listPaymentAccounts() });
  const types = useQuery({ queryKey: ['cylinderTypes'], queryFn: () => api.setup.listCylinderTypes() });

  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [gasKg, setGasKg] = useState('');
  const [gasValue, setGasValue] = useState('');
  const [cylTypeId, setCylTypeId] = useState('');
  const [filled, setFilled] = useState('0');
  const [empty, setEmpty] = useState('0');
  const [shellValue, setShellValue] = useState('');

  const locked = settings.data?.settings.openingLocked;

  const post = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      if (accountId && amount) body.paymentAccounts = [{ accountId, amount }];
      if (gasKg && gasValue) body.gas = { kg: gasKg, value: gasValue };
      if (cylTypeId) {
        body.cylinders = [
          { cylinderTypeId: cylTypeId, filled: Number(filled) || 0, empty: Number(empty) || 0, shellAssetValue: shellValue || undefined },
        ];
      }
      return api.setup.postOpeningBalances(body);
    },
    onSuccess: () => {
      ['settings', 'paymentAccounts', 'gasInventory', 'cylinderInventory'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setOpen(false);
      toast('Opening balances posted', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Opening balances</CardTitle>
        {!locked && (
          <Button variant="success" size="sm" onClick={() => setOpen(true)}>
            <BookOpen className="mr-1.5 h-4 w-4" /> Post opening balances
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {locked ? (
          <p className="text-sm text-muted-foreground">Opening balances have been posted and are locked.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set your starting cash, gas stock, and cylinders. This posts once as a balanced opening entry.
          </p>
        )}
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Post opening balances" className="max-w-2xl">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Cash/bank account</Label>
            <select className={selectClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— none —</option>
              {accounts.data?.paymentAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Opening amount</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Opening gas (kg)</Label>
            <Input value={gasKg} onChange={(e) => setGasKg(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Opening gas value</Label>
            <Input value={gasValue} onChange={(e) => setGasValue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cylinder type</Label>
            <select className={selectClass} value={cylTypeId} onChange={(e) => setCylTypeId(e.target.value)}>
              <option value="">— none —</option>
              {types.data?.cylinderTypes.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Filled</Label>
              <Input value={filled} onChange={(e) => setFilled(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Empty</Label>
              <Input value={empty} onChange={(e) => setEmpty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Shell value</Label>
              <Input value={shellValue} onChange={(e) => setShellValue(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => post.mutate()} disabled={post.isPending}>
            {post.isPending ? 'Posting…' : 'Post opening balances'}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
