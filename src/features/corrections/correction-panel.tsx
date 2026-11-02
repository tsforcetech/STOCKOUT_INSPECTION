import * as React from "react";
import { Link, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, NotePencilIcon } from "@phosphor-icons/react";
import { SectionCard } from "@/components/common/section-card";
import { DetailList } from "@/components/common/page-header";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/feedback/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useAccess } from "@/lib/auth/use-access";
import { isApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/utils/format";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import type { InspectionDetailDto, MediaAssetDto } from "@/api/types/catalog-moderation";
import type { CorrectionMediaItemDto, CorrectionSnapshotResponse, ProposeListingCorrectionRequest } from "@/api/types/listing-corrections";
import { listingCorrectionsService } from "@/services/listing-corrections.service";
import { moderationService } from "@/services/moderation.service";
import { catalogService } from "@/services/catalog.service";
import { listingKeys } from "@/features/listings/queries";
import { ApiErrorNotice, Notice, PanelTitle, fmtUtc, shortId } from "@/features/listings/shared";
import { MediaTile } from "@/features/listings/review/version-comparison";
import { useInspectorRights } from "@/features/inspections/detail/actions";
import { correctionKeys, useConditionGradeNames, useCorrectionsQuery } from "./queries";
import { CorrectionError, CorrectionStatusBadge, FIELD_LABEL } from "./shared";

const PROPOSE_STATES = ["IN_PROGRESS", "COMPLETED"];
/** The inspected version must still be the live one or the open draft (MARKETPLACE_CORRECTION_BASE_VERSION_NOT_CURRENT). */
const STALE_BASE = ["SUPERSEDED", "ARCHIVED", "REJECTED"];

/** Inspection detail → current listing values, existing proposals and "Propose corrections" (E5). */
export function CorrectionPanel({ inspection }: { inspection: InspectionDetailDto }) {
  const { can } = useAccess();
  const { isAssignee } = useInspectorRights(inspection.assignedInspectorUserId);
  const names = useConditionGradeNames();
  const [open, setOpen] = React.useState(false);
  const snapshot = useQuery({
    queryKey: correctionKeys.snapshot(inspection.inspectionId),
    queryFn: ({ signal }) => listingCorrectionsService.snapshot(inspection.inspectionId, signal),
    retry: false,
  });
  const proposals = useCorrectionsQuery({ inspectionId: inspection.inspectionId, page: 1, pageSize: 20 });
  const s = snapshot.data;

  const staleBase = !!s && STALE_BASE.includes(s.baseVersionStatus);
  const canPropose = isAssignee && can(P.INSPECTIONS_OVERRIDE) && PROPOSE_STATES.includes(inspection.status) && !!s && !s.hasActiveCorrection && !staleBase;
  const why = !isAssignee
    ? "Only the inspector assigned to this inspection can propose corrections."
    : !can(P.INSPECTIONS_OVERRIDE)
      ? "Proposing corrections needs the inspections.override permission."
      : !PROPOSE_STATES.includes(inspection.status)
        ? "Corrections can be proposed once the inspection is in progress or completed."
        : s?.hasActiveCorrection
          ? "This listing already has an open proposal."
          : staleBase
            ? "The inspected version has since been replaced by a newer one. Corrections need an inspection of the current version."
            : null;

  return (
    <SectionCard>
      <PanelTitle
        title="Listing corrections"
        description="Propose changes to the listing based on what you found. The live listing doesn't change until the proposal is accepted (where needed), approved and published."
        actions={
          <Button variant="action" disabled={!canPropose} onClick={() => setOpen(true)} title={why ?? undefined}>
            <NotePencilIcon /> Propose corrections
          </Button>
        }
      />
      {snapshot.error ? (
        <ErrorState error={snapshot.error} onRetry={() => snapshot.refetch()} title="Couldn't load the listing snapshot" />
      ) : !s ? (
        <p className="text-sm text-muted-foreground">Loading listing values…</p>
      ) : (
        <>
          {s.hasActiveCorrection && s.activeCorrectionId && (
            <Notice className="mb-3" title="Open proposal">
              This listing already has an open correction proposal.{" "}
              <Link className="underline underline-offset-4" to={`/corrections/${s.activeCorrectionId}`}>
                Open it
              </Link>
              .
            </Notice>
          )}
          {why && !s.hasActiveCorrection && <p className="mb-3 text-xs text-muted-foreground">{why}</p>}
          <DetailList
            columns={3}
            items={[
              { label: "Title", value: s.title, full: true },
              { label: "Description", value: s.description ? <span className="whitespace-pre-wrap">{s.description}</span> : "—", full: true },
              { label: "Price", value: formatMoney(s.basePrice, s.currency) },
              { label: "Condition", value: s.conditionId ? (names.get(s.conditionId.toLowerCase()) ?? s.conditionId) : "—" },
              { label: "Grade", value: s.gradeId ? (names.get(s.gradeId.toLowerCase()) ?? s.gradeId) : "—" },
              { label: "On hand / reserved", value: `${s.onHandQuantity} / ${s.reservedQuantity}` },
              { label: "Photos & documents", value: `${s.media.length} item(s)` },
              { label: "Listing / version", value: `${s.listingStatus} · v ${s.baseVersionStatus}` },
              {
                label: "Seller must accept",
                value: (
                  <span className="flex flex-wrap gap-1">
                    {s.sellerAcceptanceFields.map((f) => (
                      <Badge key={f} tone="warning">
                        {FIELD_LABEL[f] ?? f}
                      </Badge>
                    ))}
                  </span>
                ),
                full: true,
              },
            ]}
          />
        </>
      )}

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Proposals from this inspection</h3>
        {proposals.error ? (
          <ApiErrorNotice error={proposals.error} />
        ) : (proposals.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{proposals.isLoading ? "Loading…" : "None yet."}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {proposals.data!.items.map((c) => (
              <li key={c.correctionId}>
                <Link to={`/corrections/${c.correctionId}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted">
                  <span className="font-mono text-xs">{c.correctionNo}</span>
                  <CorrectionStatusBadge status={c.status} />
                  <span className="text-muted-foreground">{c.changes.map((x) => FIELD_LABEL[x.field] ?? x.field).join(", ")}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{fmtUtc(c.createdAtUtc)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {s && open && <ProposeDialog snapshot={s} onClose={() => setOpen(false)} />}
    </SectionCard>
  );
}

interface MediaRow extends CorrectionMediaItemDto {
  keep: boolean;
}

function sameMedia(a: CorrectionMediaItemDto[], b: CorrectionMediaItemDto[]) {
  const key = (m: CorrectionMediaItemDto) => `${m.fileAssetId}|${m.mediaType}|${m.displayOrder}|${m.isPrimary}`;
  return a.length === b.length && a.map(key).sort().join() === b.map(key).sort().join();
}

function ProposeDialog({ snapshot: s, onClose }: { snapshot: CorrectionSnapshotResponse; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: listingKeys.detail(s.listingId, s.baseListingVersionId),
    queryFn: ({ signal }) => moderationService.detail(s.listingId, s.baseListingVersionId, signal),
    retry: false,
  });
  const categoryId = detail.data?.candidateVersion.categoryId;
  const catConditions = useQuery({
    queryKey: ["catalog", "category-conditions", categoryId],
    queryFn: ({ signal }) => catalogService.categoryConditions(categoryId!, signal),
    enabled: !!categoryId,
  });
  const allConditions = useQuery({ queryKey: ["catalog", "conditions"], queryFn: ({ signal }) => catalogService.conditions(signal), staleTime: 10 * 60_000 });
  const conditionOptions = catConditions.data?.effectiveConditions.length
    ? catConditions.data.effectiveConditions.map((c) => ({ id: c.conditionId, name: c.name }))
    : (allConditions.data ?? []).filter((c) => c.isActive).map((c) => ({ id: c.conditionId, name: c.name }));

  const [title, setTitle] = React.useState(s.title);
  const [description, setDescription] = React.useState(s.description ?? "");
  const [conditionId, setConditionId] = React.useState(s.conditionId ?? "");
  const [gradeId, setGradeId] = React.useState(s.gradeId ?? "");
  const [price, setPrice] = React.useState(String(s.basePrice));
  const [quantity, setQuantity] = React.useState(String(s.onHandQuantity));
  const [media, setMedia] = React.useState<MediaRow[]>(() => [...s.media].sort((a, b) => a.displayOrder - b.displayOrder).map((m) => ({ ...m, keep: true })));
  const [summary, setSummary] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const grades = useQuery({
    queryKey: ["catalog", "condition-grades", conditionId],
    queryFn: ({ signal }) => catalogService.conditionGrades(conditionId, signal),
    enabled: !!conditionId,
  });

  const tiles = new Map<string, MediaAssetDto>((detail.data?.mediaAssets ?? []).map((m) => [m.fileAssetId.toLowerCase(), m]));

  const move = (i: number, d: -1 | 1) =>
    setMedia((rows) => {
      const next = [...rows];
      const j = i + d;
      if (j < 0 || j >= next.length) return rows;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const build = (): ProposeListingCorrectionRequest | string => {
    const body: ProposeListingCorrectionRequest = { inspectionId: s.inspectionId, sellerVisibleSummary: summary.trim(), inspectorNotes: notes.trim() || null };
    if (!body.sellerVisibleSummary) return "Write a summary for the seller.";
    if (body.sellerVisibleSummary.length > 2000) return "The seller summary can be at most 2,000 characters.";
    if ((body.inspectorNotes?.length ?? 0) > 4000) return "Private notes can be at most 4,000 characters.";
    if (title.trim() !== s.title) {
      if (!title.trim()) return "The title can't be empty.";
      body.title = title.trim();
    }
    if (description.trim() !== (s.description ?? "")) {
      if (!description.trim()) return "A correction can't clear the description.";
      body.description = description.trim();
    }
    if ((conditionId || null) !== (s.conditionId ?? null) && conditionId) body.conditionId = conditionId;
    if ((gradeId || null) !== (s.gradeId ?? null) && gradeId) body.gradeId = gradeId;
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0 || !/^\d+(\.\d{1,4})?$/.test(price.trim())) return "Price must be above 0 with at most 4 decimal places.";
    if (p !== s.basePrice) body.basePrice = p;
    const q = Number(quantity);
    if (!Number.isFinite(q) || q < 0) return "Quantity must be 0 or more.";
    if (q !== s.onHandQuantity) body.onHandQuantity = q;
    const kept = media.filter((m) => m.keep);
    let order = 0;
    const desired: CorrectionMediaItemDto[] = kept.map((m) => ({
      fileAssetId: m.fileAssetId,
      mediaType: m.mediaType,
      displayOrder: m.mediaType === "IMAGE" ? ++order : m.displayOrder,
      isPrimary: m.mediaType === "IMAGE" && m.isPrimary,
      documentType: m.documentType,
    }));
    const images = desired.filter((m) => m.mediaType === "IMAGE");
    if (images.length > 0 && images.filter((m) => m.isPrimary).length !== 1) return "Choose exactly one cover photo.";
    if (!sameMedia(desired, s.media)) body.media = desired;
    const changed = ["title", "description", "conditionId", "gradeId", "basePrice", "onHandQuantity", "media"].some((k) => k in body);
    if (!changed) return "Change at least one field.";
    return body;
  };

  const propose = useApiMutation({
    mutationFn: (body: ProposeListingCorrectionRequest) => listingCorrectionsService.propose(body),
    toastOnError: false,
    successMessage: (c) => `${c.correctionNo} proposed.`,
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: correctionKeys.all });
      onClose();
      navigate(`/corrections/${c.correctionId}`);
    },
  });

  const submit = () => {
    const body = build();
    if (typeof body === "string") return setError(body);
    setError(null);
    propose.mutate(body, {
      onError: (e) => {
        if (isApiError(e) && e.code === "MARKETPLACE_CORRECTION_ALREADY_ACTIVE") void qc.invalidateQueries({ queryKey: correctionKeys.snapshot(s.inspectionId) });
      },
    });
  };

  const accept = new Set(s.sellerAcceptanceFields);
  const mark = (f: string) => (accept.has(f) ? " · seller must accept" : "");

  return (
    <Dialog open onOpenChange={(o) => !o && !propose.isPending && onClose()}>
      <DialogContent
        size="lg"
        title={`Propose corrections · ${s.inspectionNo}`}
        description="Edit only what needs to change; unchanged fields are left as they are. The seller sees your summary and the before/after values, never your private notes."
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={propose.isPending}>
              Cancel
            </Button>
            <Button variant="primary" loading={propose.isPending} onClick={submit}>
              Propose
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Notice tone="danger">{error}</Notice>}
          <CorrectionError error={propose.error} />
          <FormField label="Title" htmlFor="c-title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </FormField>
          <FormField label="Description" htmlFor="c-description" hint="Can be changed, not cleared.">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Condition" htmlFor="c-condition">
              <NativeSelect
                value={conditionId}
                onChange={(e) => {
                  setConditionId(e.target.value);
                  setGradeId("");
                }}
              >
                <option value="">{s.conditionId ? "—" : "Not set"}</option>
                {conditionOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={`Grade${mark("grade")}`} htmlFor="c-grade" hint={!conditionId ? "Choose a condition first." : undefined}>
              <NativeSelect value={gradeId} onChange={(e) => setGradeId(e.target.value)} disabled={!conditionId}>
                <option value="">{s.gradeId ? "—" : "Not set"}</option>
                {(grades.data ?? []).map((g) => (
                  <option key={g.gradeId} value={g.gradeId}>
                    {g.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={`Price (${s.currency})${mark("price")}`} htmlFor="c-price">
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </FormField>
            <FormField label={`Quantity on hand${mark("quantity")}`} htmlFor="c-quantity" hint={`Absolute target. Applied only when the corrected version is published (reserved: ${s.reservedQuantity}).`}>
              <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </FormField>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">Photos & documents</legend>
            {media.length === 0 ? (
              <p className="text-sm text-muted-foreground">The listing has no media.</p>
            ) : (
              <ul className="space-y-2">
                {media.map((m, i) => {
                  const tile = tiles.get(m.fileAssetId.toLowerCase());
                  return (
                    <li key={m.fileAssetId} className={`flex items-center gap-3 rounded-md border border-border p-2 ${m.keep ? "" : "opacity-50"}`}>
                      <div className="size-14 shrink-0 overflow-hidden rounded bg-surface-muted">
                        {tile && m.mediaType === "IMAGE" ? <MediaTile listingId={s.listingId} versionId={s.baseListingVersionId} media={tile} onState={() => {}} /> : null}
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-medium text-foreground">
                          {m.mediaType === "IMAGE" ? "Photo" : (m.documentType ?? "Document")} · {shortId(m.fileAssetId)}
                        </p>
                        <label className="mt-1 inline-flex items-center gap-1">
                          <input type="checkbox" checked={m.keep} onChange={(e) => setMedia((rows) => rows.map((r, k) => (k === i ? { ...r, keep: e.target.checked, isPrimary: e.target.checked && r.isPrimary } : r)))} /> Keep
                        </label>
                        {m.mediaType === "IMAGE" && (
                          <label className="ml-3 inline-flex items-center gap-1">
                            <input
                              type="radio"
                              name="c-primary"
                              checked={m.isPrimary}
                              disabled={!m.keep}
                              onChange={() => setMedia((rows) => rows.map((r, k) => ({ ...r, isPrimary: k === i && r.mediaType === "IMAGE" })))}
                            />{" "}
                            Cover
                          </label>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUpIcon />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Move down" disabled={i === media.length - 1} onClick={() => move(i, 1)}>
                          <ArrowDownIcon />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-1 text-xs text-muted-foreground">You can remove, reorder or change the cover photo. New files can't be added here.</p>
          </fieldset>

          <FormField label="Summary for the seller" htmlFor="c-summary" required hint="Shown to the seller with the proposed changes.">
            <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />
          </FormField>
          <FormField label="Private notes" htmlFor="c-notes" hint="Platform staff only — never shown to the seller.">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
          </FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}
