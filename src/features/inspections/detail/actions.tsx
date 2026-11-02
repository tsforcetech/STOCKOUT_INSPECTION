import * as React from "react";
import { useNavigate } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowsClockwiseIcon, CheckSquareIcon, PlayIcon, ProhibitIcon, UserPlusIcon, UserSwitchIcon } from "@phosphor-icons/react";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useAccess } from "@/lib/auth/use-access";
import { platformService } from "@/services/platform.service";
import { useAuth } from "@/lib/auth/auth-context";
import { isApiError } from "@/lib/api/errors";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import type { InspectionDetailDto, InspectionResult } from "@/api/types/catalog-moderation";
import { inspectionsService } from "@/services/inspections.service";
import { listingKeys } from "@/features/listings/queries";
import { ApiErrorNotice, GUID_RE, Notice, isConflict, isGuid } from "@/features/listings/shared";
import { inspectionKeys } from "../queries";

type Open = "assign" | "reassign" | "start" | "complete" | "cancel" | "reinspect" | null;

/** Who may act as the inspector: the assignee, or anyone with the supervisor override. */
export function useInspectorRights(assignedInspectorUserId: string | null | undefined) {
  const { can } = useAccess();
  const { user } = useAuth();
  const isAssignee = Boolean(user?.userId && assignedInspectorUserId && user.userId.toLowerCase() === assignedInspectorUserId.toLowerCase());
  const canAct = can(P.INSPECTIONS_PERFORM) && (isAssignee || can(P.INSPECTIONS_OVERRIDE));
  return { isAssignee, canAct };
}

export function InspectionActions({ inspection }: { inspection: InspectionDetailDto }) {
  const { can } = useAccess();
  const { canAct } = useInspectorRights(inspection.assignedInspectorUserId);
  const [open, setOpen] = React.useState<Open>(null);
  const s = inspection.status;
  const close = () => setOpen(null);

  const canAssign = can(P.INSPECTIONS_ASSIGN);
  const canOverride = can(P.INSPECTIONS_OVERRIDE);
  const actions = {
    assign: s === "PENDING" && canAssign,
    reassign: (s === "ASSIGNED" || s === "IN_PROGRESS") && canAssign,
    start: s === "ASSIGNED" && canAct,
    complete: s === "IN_PROGRESS" && canAct,
    cancel: (s === "PENDING" || s === "ASSIGNED" || s === "IN_PROGRESS") && canOverride,
    reinspect: s === "COMPLETED" && (inspection.result === "FAIL" || inspection.result === "REINSPECTION_REQUIRED") && canOverride,
  };
  const any = Object.values(actions).some(Boolean);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.start && (
          <Button variant="action" size="lg" className="h-12 text-base" onClick={() => setOpen("start")}>
            <PlayIcon /> Start inspection
          </Button>
        )}
        {actions.complete && (
          <Button variant="action" size="lg" className="h-12 text-base" onClick={() => setOpen("complete")}>
            <CheckSquareIcon /> Complete
          </Button>
        )}
        {actions.assign && (
          <Button variant="action" size="lg" className="h-12 text-base" onClick={() => setOpen("assign")}>
            <UserPlusIcon /> Assign inspector
          </Button>
        )}
        {actions.reassign && (
          <Button variant="secondary" size="lg" className="h-12 text-base" onClick={() => setOpen("reassign")}>
            <UserSwitchIcon /> Reassign
          </Button>
        )}
        {actions.reinspect && (
          <Button variant="action" size="lg" className="h-12 text-base" onClick={() => setOpen("reinspect")}>
            <ArrowsClockwiseIcon /> Authorize re-inspection
          </Button>
        )}
        {actions.cancel && (
          <Button variant="danger-ghost" size="lg" className="h-12 text-base" onClick={() => setOpen("cancel")}>
            <ProhibitIcon /> Cancel inspection
          </Button>
        )}
      </div>
      {!any && s !== "COMPLETED" && s !== "CANCELLED" && <span className="sr-only">No actions available with your permissions.</span>}

      <AssignDialog open={open === "assign" || open === "reassign"} mode={open === "reassign" ? "reassign" : "assign"} inspection={inspection} onClose={close} />
      <StartDialog open={open === "start"} inspection={inspection} onClose={close} />
      <CompleteDialog open={open === "complete"} inspection={inspection} onClose={close} />
      <CancelDialog open={open === "cancel"} inspection={inspection} onClose={close} />
      <ReinspectDialog open={open === "reinspect"} inspection={inspection} onClose={close} />
    </>
  );
}

/** Clears a previous attempt's error when a dialog is reopened. */
function useResetOnOpen(open: boolean, reset: () => void) {
  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);
}

/** Shared mutation wrapper: reloads the detail on a rowVersion conflict, refreshes queue + listing caches on success. */
function useInspectionMutation<TVars, TData>(inspection: InspectionDetailDto, fn: (vars: TVars) => Promise<TData>, successMessage: string | ((d: TData) => string), onSuccess?: (d: TData) => void) {
  const queryClient = useQueryClient();
  const key = inspectionKeys.detail(inspection.inspectionId);
  return useApiMutation<TData, TVars>({
    mutationFn: async (vars) => {
      try {
        return await fn(vars);
      } catch (e) {
        if (isConflict(e) || (isApiError(e) && e.code === "MARKETPLACE_INSPECTION_TRANSITION_INVALID")) await queryClient.invalidateQueries({ queryKey: key });
        throw e;
      }
    },
    toastOnError: false,
    invalidate: [key, inspectionKeys.queueAll, listingKeys.listing(inspection.listingId)],
    successMessage,
    onSuccess,
  });
}

/** Users who may be assigned inspections (backend F2-H): inspections.perform or Platform Super Admin, enabled only. */
function useEligibleInspectors(open: boolean) {
  return useQuery({
    queryKey: ["platform", "inspectors", "eligible"],
    queryFn: ({ signal }) => platformService.eligibleInspectors({ page: 1, pageSize: 100 }, signal),
    enabled: open,
    staleTime: 60_000,
  });
}

function AssignDialog({ open, mode, inspection, onClose }: { open: boolean; mode: "assign" | "reassign"; inspection: InspectionDetailDto; onClose: () => void }) {
  const inspectors = useEligibleInspectors(open);
  const [manual, setManual] = React.useState(false);
  const [userId, setUserId] = React.useState("");
  const [reasonCode, setReasonCode] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const usePicker = !manual && !inspectors.error;

  const mutation = useInspectionMutation(
    inspection,
    (id: string) =>
      mode === "assign"
        ? inspectionsService.assign(inspection.inspectionId, { inspectorUserId: id, expectedRowVersion: inspection.rowVersion })
        : inspectionsService.reassign(inspection.inspectionId, { newInspectorUserId: id, reasonCode: reasonCode.trim() || null, notes: notes.trim() || null, expectedRowVersion: inspection.rowVersion }),
    mode === "assign" ? "Inspector assigned." : "Inspector reassigned.",
    () => {
      setUserId("");
      setReasonCode("");
      setNotes("");
      setTouched(false);
      onClose();
    },
  );
  useResetOnOpen(open, mutation.reset);

  const candidates = React.useMemo(
    () => (inspectors.data?.items ?? []).filter((u) => u.isEnabled && u.userId.toLowerCase() !== (inspection.assignedInspectorUserId ?? "").toLowerCase()),
    [inspectors.data, inspection.assignedInspectorUserId],
  );
  const invalid = !isGuid(userId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !mutation.isPending && onClose()}>
      <DialogContent
        title={mode === "assign" ? "Assign inspector" : "Reassign inspector"}
        description={mode === "assign" ? "The inspection moves to Assigned." : "The inspection keeps its current status."}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={mutation.isPending}
              onClick={() => {
                setTouched(true);
                if (!invalid) mutation.mutate(userId.trim().toLowerCase());
              }}
            >
              {mode === "assign" ? "Assign" : "Reassign"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {usePicker ? (
            <FormField
              label="Inspector"
              htmlFor="assign-user"
              required
              error={touched && invalid ? "Choose a user." : undefined}
              hint={
                inspectors.isLoading
                  ? "Loading inspectors…"
                  : candidates.length === 0
                    ? "No other user can inspect yet. Give someone a role with the inspections.perform permission."
                    : `${candidates.length} inspector${candidates.length === 1 ? "" : "s"} available.`
              }
            >
              <NativeSelect value={userId} onChange={(e) => setUserId(e.target.value)} disabled={inspectors.isLoading} searchable searchPlaceholder="Search name or email…">
                <option value="">Select an inspector</option>
                {candidates.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.displayName || u.email || u.userId}
                    {u.displayName && u.email ? ` · ${u.email}` : ""}
                    {u.roles.length ? ` · ${u.roles.map((r) => r.name || r.code).join(", ")}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : (
            <FormField label="Inspector user ID" htmlFor="assign-user-id" required error={touched && invalid ? "Enter a valid user ID (GUID)." : undefined}>
              <Input className="font-mono text-xs" value={userId} onChange={(e) => setUserId(e.target.value)} pattern={GUID_RE.source} autoComplete="off" />
            </FormField>
          )}
          {inspectors.error ? (
            <ApiErrorNotice error={inspectors.error} />
          ) : (
            <Button variant="link" size="sm" onClick={() => { setManual((m) => !m); setUserId(""); }}>
              {manual ? "Pick from the inspector list" : "Enter a user ID instead"}
            </Button>
          )}
          {mode === "reassign" && (
            <>
              <FormField label="Reason code" htmlFor="reassign-reason" hint="Optional, up to 50 characters.">
                <Input maxLength={50} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} />
              </FormField>
              <FormField label="Notes" htmlFor="reassign-notes">
                <Textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormField>
            </>
          )}
          <ApiErrorNotice error={mutation.error} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StartDialog({ open, inspection, onClose }: { open: boolean; inspection: InspectionDetailDto; onClose: () => void }) {
  const mutation = useInspectionMutation(inspection, () => inspectionsService.start(inspection.inspectionId, inspection.rowVersion), "Inspection started.", onClose);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Start inspection?"
      description="The inspection moves to In progress so checklist responses and evidence can be recorded."
      confirmLabel="Start"
      tone="primary"
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate(undefined)}
    >
      <ApiErrorNotice error={mutation.error} />
    </ConfirmDialog>
  );
  useResetOnOpen(open, mutation.reset);
}

const completeSchema = z
  .object({
    result: z.enum(["PASS", "FAIL", "REINSPECTION_REQUIRED"]),
    summary: z.string().max(2000),
    failureReasonCode: z.string().trim().max(100),
    failureNotes: z.string().max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.result === "PASS") return;
    if (!v.failureReasonCode) ctx.addIssue({ code: "custom", path: ["failureReasonCode"], message: "A failure reason code is required." });
    if (v.failureNotes.trim().length < 10) ctx.addIssue({ code: "custom", path: ["failureNotes"], message: "Failure notes must be at least 10 characters." });
  });
type CompleteValues = z.infer<typeof completeSchema>;

function CompleteDialog({ open, inspection, onClose }: { open: boolean; inspection: InspectionDetailDto; onClose: () => void }) {
  const form = useForm<CompleteValues>({ resolver: zodResolver(completeSchema), defaultValues: { result: "PASS", summary: "", failureReasonCode: "", failureNotes: "" } });
  const result = useWatch({ control: form.control, name: "result" });
  const mutation = useInspectionMutation(
    inspection,
    (v: CompleteValues) =>
      inspectionsService.complete(inspection.inspectionId, {
        result: v.result as InspectionResult,
        summary: v.summary.trim() || null,
        failureReasonCode: v.result === "PASS" ? null : v.failureReasonCode.trim(),
        failureNotes: v.result === "PASS" ? null : v.failureNotes.trim(),
        expectedRowVersion: inspection.rowVersion,
      }),
    (r) => `Inspection completed: ${r.result ?? "done"}.`,
    () => {
      form.reset();
      onClose();
    },
  );
  useResetOnOpen(open, mutation.reset);
  const missingRequired = inspection.responses.filter((r) => r.isRequiredSnapshot && !r.itemResult).length;
  const failedRequired = inspection.responses.filter((r) => r.isRequiredSnapshot && r.itemResult === "FAIL").length;
  const missingEvidence = inspection.responses.filter((r) => r.requiresEvidenceSnapshot).length > 0 && inspection.evidence.length === 0;
  const errors = form.formState.errors;
  const submit = form.handleSubmit((v) => mutation.mutate(v));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !mutation.isPending && onClose()}>
      <DialogContent
        title="Complete inspection"
        description="Record the outcome. A PASS moves a listing version waiting on inspection to Approved."
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button variant={result === "PASS" ? "primary" : "danger"} loading={mutation.isPending} onClick={submit}>
              Complete as {result === "PASS" ? "pass" : result === "FAIL" ? "fail" : "reinspection required"}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          {missingRequired > 0 && (
            <Notice tone="warning" title={`${missingRequired} required item${missingRequired === 1 ? " has" : "s have"} no stored result`}>
              Answer them in the Checklist and save before completing — the server rejects completion until every required item has a result.
            </Notice>
          )}
          {result === "PASS" && failedRequired > 0 && <Notice tone="warning">A required item is marked Fail; the server will not accept a PASS.</Notice>}
          {result === "PASS" && missingEvidence && <Notice tone="warning">Some items require evidence and none is attached; the server will not accept a PASS.</Notice>}
          <FormField label="Result" htmlFor="complete-result" required>
            <NativeSelect {...form.register("result")}>
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
              <option value="REINSPECTION_REQUIRED">Reinspection required</option>
            </NativeSelect>
          </FormField>
          <FormField label="Summary" htmlFor="complete-summary" error={errors.summary?.message}>
            <Textarea rows={3} maxLength={2000} {...form.register("summary")} />
          </FormField>
          {result !== "PASS" && (
            <>
              <FormField label="Failure reason code" htmlFor="complete-failure-code" required error={errors.failureReasonCode?.message}>
                <Input maxLength={100} {...form.register("failureReasonCode")} />
              </FormField>
              <FormField label="Failure notes" htmlFor="complete-failure-notes" required error={errors.failureNotes?.message} hint="At least 10 characters.">
                <Textarea rows={3} maxLength={2000} {...form.register("failureNotes")} />
              </FormField>
            </>
          )}
          <ApiErrorNotice error={mutation.error} />
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ open, inspection, onClose }: { open: boolean; inspection: InspectionDetailDto; onClose: () => void }) {
  const [reasonCode, setReasonCode] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const mutation = useInspectionMutation(
    inspection,
    () => inspectionsService.cancel(inspection.inspectionId, { reasonCode: reasonCode.trim(), notes: notes.trim() || null, expectedRowVersion: inspection.rowVersion }),
    "Inspection cancelled.",
    () => {
      setReasonCode("");
      setNotes("");
      setTouched(false);
      onClose();
    },
  );
  useResetOnOpen(open, mutation.reset);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Cancel inspection?"
      description="The inspection is cancelled. The listing version status is not changed; a new inspection can be created from the listing review page."
      confirmLabel="Cancel inspection"
      loading={mutation.isPending}
      onConfirm={() => {
        setTouched(true);
        if (reasonCode.trim()) mutation.mutate(undefined);
      }}
    >
      <div className="space-y-3">
        <FormField label="Reason code" htmlFor="cancel-reason" required error={touched && !reasonCode.trim() ? "A reason code is required." : undefined}>
          <Input maxLength={50} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} />
        </FormField>
        <FormField label="Notes" htmlFor="cancel-notes">
          <Textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <ApiErrorNotice error={mutation.error} />
      </div>
    </ConfirmDialog>
  );
}

function ReinspectDialog({ open, inspection, onClose }: { open: boolean; inspection: InspectionDetailDto; onClose: () => void }) {
  const navigate = useNavigate();
  const mutation = useInspectionMutation(
    inspection,
    () => inspectionsService.authorizeReinspection(inspection.inspectionId),
    (r) => `Re-inspection ${r.inspectionNo} created.`,
    (r) => {
      onClose();
      navigate(`/inspections/${r.inspectionId}`);
    },
  );
  useResetOnOpen(open, mutation.reset);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Authorize re-inspection?"
      description="A new pending inspection is created for the same listing version, with the checklist re-snapshotted from the current template. The server does not store notes for this action."
      confirmLabel="Authorize"
      tone="primary"
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate(undefined)}
    >
      <ApiErrorNotice error={mutation.error} />
    </ConfirmDialog>
  );
}
