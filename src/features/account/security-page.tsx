import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { AccountTabs } from "./account-tabs";
import { ChangePasswordCard } from "./change-password-card";
import { SessionsCard } from "./sessions-card";
import { MfaCard } from "./mfa-card";
import { ActivityCard } from "./activity-card";

function CardTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-heading text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <>
      <PageHeader eyebrow="StockOut inspection" title="My Profile" description="Password, active sessions, two-factor authentication and sign-in history." />
      <AccountTabs />
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard>
            <CardTitle title="Change password" description="Use at least 12 characters." />
            <ChangePasswordCard />
          </SectionCard>
          <SectionCard>
            <CardTitle title="Two-factor authentication" description="Require an emailed code when you sign in." />
            <MfaCard />
          </SectionCard>
        </div>
        <SectionCard>
          <CardTitle title="Active sessions" description="Browsers and devices currently signed in to your account." />
          <SessionsCard />
        </SectionCard>
        <SectionCard>
          <CardTitle title="Account activity" description="Security events for your account, newest first." />
          <ActivityCard />
        </SectionCard>
      </div>
    </>
  );
}
