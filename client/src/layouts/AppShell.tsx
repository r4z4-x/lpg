import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  ownerOnly?: boolean;
  end?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

// Same routes as before — only grouped into collapsible sections.
const GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', ownerOnly: true, end: true },
      { to: '/inventory', label: 'Inventory' },
    ],
  },
  {
    label: 'Sales & Customers',
    items: [
      { to: '/sales', label: 'Sales' },
      { to: '/customers', label: 'Customers' },
      { to: '/cylinders', label: 'Cylinders' },
    ],
  },
  {
    label: 'Purchasing',
    items: [
      { to: '/purchases', label: 'Purchases' },
      { to: '/vendors', label: 'Vendors' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/expenses', label: 'Expenses' },
      { to: '/cash', label: 'Cash' },
      { to: '/reports', label: 'Reports', ownerOnly: true },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/adjustments', label: 'Adjustments', ownerOnly: true },
      { to: '/setup', label: 'Setup', ownerOnly: true },
      { to: '/users', label: 'Users', ownerOnly: true },
    ],
  },
];

export function AppShell() {
  const { user, isOwner, logout } = useAuth();

  // Visible groups (after role filtering), dropping any that end up empty.
  const visibleGroups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.ownerOnly || isOwner),
  })).filter((g) => g.items.length > 0);

  // A group starts expanded if it contains the active route; default all expanded.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (label: string) => setCollapsed((c) => ({ ...c, [label]: !c[label] }));

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Fixed, brand-colored, grouped sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-slate-900 text-slate-100 md:flex">
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            L
          </div>
          <div className="text-base font-semibold tracking-tight">LPG Console</div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {visibleGroups.map((g) => {
            const isOpen = !collapsed[g.label]; // default open
            return (
              <div key={g.label} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggle(g.label)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
                >
                  <span>{g.label}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen ? '' : '-rotate-90')} />
                </button>
                {isOpen && (
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {g.items.map((n) => (
                      <NavLink
                        key={n.to}
                        to={n.to}
                        end={n.end}
                        className={({ isActive }) =>
                          cn(
                            'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                          )
                        }
                      >
                        {n.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
          Signed in as
          <div className="truncate font-medium text-slate-200">{user?.name}</div>
          <div className="text-slate-400">{user?.role}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-white/80 px-6 py-3 backdrop-blur">
          <div className="text-sm font-semibold text-slate-700 md:hidden">LPG Console</div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {user?.name} <span className="text-muted-foreground">({user?.role})</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="mr-1.5 h-4 w-4" /> Log out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
