import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireOwner } from '@/lib/auth/guards';
import { useAuth } from '@/lib/auth/useAuth';
import { AppShell } from '@/layouts/AppShell';
import LoginPage from '@/pages/LoginPage';
import SetupPage from '@/pages/setup/SetupPage';
import UsersPage from '@/pages/UsersPage';
import DashboardPage from '@/pages/DashboardPage';
import InventoryPage from '@/pages/InventoryPage';
import VendorsPage from '@/pages/VendorsPage';
import PurchasesPage from '@/pages/PurchasesPage';
import CustomersPage from '@/pages/CustomersPage';
import SalesPage from '@/pages/SalesPage';
import CylindersPage from '@/pages/CylindersPage';
import ExpensesPage from '@/pages/ExpensesPage';
import CashPage from '@/pages/CashPage';
import AdjustmentsPage from '@/pages/AdjustmentsPage';
import ReportsPage from '@/pages/ReportsPage';

/** Home: Owners see the dashboard; Operators are sent to the sales screen. */
function HomeIndex() {
  const { isOwner } = useAuth();
  if (!isOwner) return <Navigate to="/sales" replace />;
  return <DashboardPage />;
}

const owner = (el: React.ReactNode) => <RequireOwner>{el}</RequireOwner>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomeIndex />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="cylinders" element={<CylindersPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="cash" element={<CashPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="adjustments" element={owner(<AdjustmentsPage />)} />
        <Route path="reports" element={owner(<ReportsPage />)} />
        <Route path="setup" element={owner(<SetupPage />)} />
        <Route path="users" element={owner(<UsersPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
