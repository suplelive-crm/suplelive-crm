import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MessageTemplateConfigAdvanced } from '@/components/automation/MessageTemplateConfigAdvanced';

export function MessageTemplatesPage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <MessageTemplateConfigAdvanced />
      </div>
    </DashboardLayout>
  );
}
