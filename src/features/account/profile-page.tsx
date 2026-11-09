import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState, PageSkeleton } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { useAuth } from "@/lib/auth/auth-context";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { platformService } from "@/services/platform.service";
import type { UpdateUserProfileRequest, UserProfileResponse } from "@/api/types/user-organization";
import { formatUtcDateTime } from "@/features/team/utc";
import { AccountTabs } from "./account-tabs";
import { accountKeys, useMyProfileQuery } from "./queries";
import { ProfilePhoto } from "./profile-photo";
import { SignInIdentity } from "./sign-in-identity";

const schema = z.object({
  displayName: z.string().trim().min(1, "Display name is required."),
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  preferredLocale: z.string().trim(),
  timeZone: z.string().trim(),
});
type Values = z.infer<typeof schema>;
const FIELDS = ["displayName", "firstName", "lastName", "preferredLocale", "timeZone"] as const;

function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

const toValues = (p: UserProfileResponse | null, fallbackName: string): Values => ({
  displayName: p?.displayName ?? fallbackName,
  firstName: p?.firstName ?? "",
  lastName: p?.lastName ?? "",
  preferredLocale: p?.preferredLocale ?? "",
  timeZone: p?.timeZone ?? "",
});

function ProfileForm({ profile, fallbackName }: { profile: UserProfileResponse | null; fallbackName: string }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(profile, fallbackName) });
  const zones = React.useMemo(timeZones, []);

  React.useEffect(() => {
    form.reset(toValues(profile, fallbackName));
  }, [profile, fallbackName, form]);

  const save = useApiMutation({
    mutationFn: (v: Values) => {
      const body: UpdateUserProfileRequest = {
        displayName: v.displayName,
        firstName: v.firstName || null,
        lastName: v.lastName || null,
        preferredLocale: v.preferredLocale || null,
        timeZone: v.timeZone || null,
      };
      // Never send null for an existing image: the backend would delete the file but keep the reference.
      if (profile?.profileImageAssetId) body.profileImageAssetId = profile.profileImageAssetId;
      return platformService.updateMyProfile(body);
    },
    invalidate: [accountKeys.profile],
    toastOnError: false,
    successMessage: "Profile saved.",
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    save.mutate(values, { onError: (e) => setFormError(applyApiErrorToForm(e, form.setError, FIELDS)) });
  });

  const e = form.formState.errors;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      {!profile && <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-muted-foreground">You don't have a profile yet. Saving creates it.</p>}
      <FormField label="Display name" htmlFor="profile-displayName" required error={e.displayName?.message}>
        <Input autoComplete="nickname" {...form.register("displayName")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="profile-firstName" error={e.firstName?.message}>
          <Input autoComplete="given-name" {...form.register("firstName")} />
        </FormField>
        <FormField label="Last name" htmlFor="profile-lastName" error={e.lastName?.message}>
          <Input autoComplete="family-name" {...form.register("lastName")} />
        </FormField>
        <FormField label="Preferred locale" htmlFor="profile-preferredLocale" error={e.preferredLocale?.message} hint="BCP 47 tag, e.g. en-GB or ar-AE.">
          <Input placeholder="en-GB" {...form.register("preferredLocale")} />
        </FormField>
        <FormField label="Time zone" htmlFor="profile-timeZone" error={e.timeZone?.message} hint="IANA name, e.g. Asia/Dubai.">
          <Input list="profile-tz-list" placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone} {...form.register("timeZone")} />
        </FormField>
        <datalist id="profile-tz-list">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>
          Save changes
        </Button>
        <Button variant="secondary" onClick={() => form.reset(toValues(profile, fallbackName))} disabled={!form.formState.isDirty || save.isPending}>
          Discard
        </Button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const profile = useMyProfileQuery();
  const identityName = user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "";
  const p = profile.data ?? null;
  const name = p?.displayName || identityName || user?.email || "Me";
  // Don't repeat the sign-in email as a heading: prefer a real name, else the part before "@".
  const realName = [name, [p?.firstName, p?.lastName].filter(Boolean).join(" "), identityName].find((n) => n && !n.includes("@"));
  const needsName = !p?.displayName || p.displayName.includes("@");
  const local = (user?.email ?? name).split("@")[0].replace(/[._-]+/g, " ").trim();
  const titleCase = (t: string) => t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const title = (realName && (realName === realName.toUpperCase() ? titleCase(realName) : realName)) || titleCase(local) || "Me";

  return (
    <>
      <PageHeader eyebrow="StockOut inspection" title="My Profile" description="Your personal details and how you appear to other administrators." />
      <AccountTabs />
      {profile.isLoading ? (
        <PageSkeleton />
      ) : profile.error ? (
        <SectionCard>
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        </SectionCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <SectionCard className="space-y-6 self-start">
            <ProfilePhoto profile={p} name={title} fallbackDisplayName={identityName}>
              <p className="truncate font-heading text-lg font-bold text-foreground" title={title}>
                {title}
              </p>
              {needsName && (
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={() => document.getElementById("profile-displayName")?.focus()}
                >
                  Add your display name
                </button>
              )}
              {user?.status && (
                <div className="mt-2 flex justify-center">
                  <StatusBadge value={user.status} />
                </div>
              )}
            </ProfilePhoto>
            <SignInIdentity user={user} />
          </SectionCard>
          <SectionCard>
            <h2 className="font-heading text-xl font-bold text-foreground">Personal details</h2>
            <p className="mb-4 text-sm text-muted-foreground">{p ? `Last updated ${formatUtcDateTime(p.updatedAtUtc)}` : "Not saved yet"}</p>
            <ProfileForm profile={p} fallbackName={identityName} />
          </SectionCard>
        </div>
      )}
    </>
  );
}
