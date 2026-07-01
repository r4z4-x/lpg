import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { formatMoney, toMajorString } from '@/lib/money';
import { useToast } from '@/components/common/Toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SettingsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api.setup.getSettings() });
  const settings = data?.settings;

  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState('');
  const [defaultSaleRate, setDefaultSaleRate] = useState('');

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName);
      setCurrency(settings.currency);
      setDefaultSaleRate(toMajorString(settings.defaultSaleRateMinor));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: () => api.setup.updateSettings({ companyName, currency, defaultSaleRate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setOpen(false);
      toast('Settings saved', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Company settings</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="mr-1.5 h-4 w-4" /> Edit
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Company</div>
          <div className="font-medium">{settings?.companyName ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Currency</div>
          <div className="font-medium">{settings?.currency ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Default sale rate / kg</div>
          <div className="font-medium">{settings ? formatMoney(settings.defaultSaleRateMinor) : '—'}</div>
        </div>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Edit company settings">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Company name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Default sale rate / kg</Label>
            <Input value={defaultSaleRate} onChange={(e) => setDefaultSaleRate(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
