import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { useToast } from '@/components/common/Toaster';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { User } from '@/lib/api/types';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export default function UsersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.users.list() });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Operator');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const create = useMutation({
    mutationFn: () => api.users.create({ name, email, password, role }),
    onSuccess: () => {
      invalidate();
      setName('');
      setEmail('');
      setPassword('');
      setOpen(false);
      toast('User created', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  const toggle = useMutation({
    mutationFn: (u: User) => api.users.update(u._id, { isActive: !u.isActive }),
    onSuccess: () => {
      invalidate();
      toast('User updated', 'success');
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  });

  const columns: Column<User>[] = [
    { header: 'Name', cell: (u) => u.name },
    { header: 'Email', cell: (u) => u.email },
    { header: 'Role', cell: (u) => u.role },
    { header: 'Active', cell: (u) => (u.isActive ? 'Yes' : 'No') },
    {
      header: '',
      cell: (u) => (
        <Button variant="outline" size="sm" onClick={() => toggle.mutate(u)} disabled={toggle.isPending}>
          {u.isActive ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Users">
        <Button variant="success" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add user
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={data?.users}
        rowKey={(u) => u._id}
        isLoading={isLoading}
        getSearchText={(u) => `${u.name} ${u.email} ${u.role}`}
        searchPlaceholder="Search users…"
        pageSize={10}
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="Add user">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="Operator">Operator</option>
              <option value="Owner">Owner</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => create.mutate()}
              disabled={create.isPending || !name || !email || password.length < 8}
            >
              Create
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
