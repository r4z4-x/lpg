import { PageHeader } from '@/components/common/PageHeader';
import { SettingsSection } from './SettingsSection';
import { CylinderTypesSection } from './CylinderTypesSection';
import { PaymentAccountsSection } from './PaymentAccountsSection';
import { OpeningBalancesSection } from './OpeningBalancesSection';

export default function SetupPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="System setup" />
      <SettingsSection />
      <CylinderTypesSection />
      <PaymentAccountsSection />
      <OpeningBalancesSection />
    </div>
  );
}
