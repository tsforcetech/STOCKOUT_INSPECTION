import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CameraIcon, FileIcon, ImageIcon, TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { SectionCard, RowAction } from "@/components/common/section-card";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatBytes } from "@/lib/utils/format";
import type { InspectionDetailDto, InspectionEvidenceDto, InspectionEvidenceType } from "@/api/types/catalog-moderation";
import { INSPECTION_EVIDENCE_FILE_PURPOSE } from "@/api/types/catalog-moderation";
import { inspectionsService } from "@/services/inspections.service";
import { filesService, FILE_LIMITS, isAllowedFileType } from "@/services/files.service";
import { ApiErrorNotice, Notice, SignedFileLink, PanelTitle, PersonText, fmtUtc, isConflict, useUserNames } from "@/features/listings/shared";
import { inspectionKeys } from "../queries";

const limit = FILE_LIMITS[INSPECTION_EVIDENCE_FILE_PURPOSE];

export function EvidencePanel({ inspection, editable }: { inspection: InspectionDetailDto; editable: boolean }) {
  const queryClient = useQueryClient();
  const names = useUserNames();
  const [removing, setRemoving] = React.useState<InspectionEvidenceDto | null>(null);
  const itemLabel = React.useMemo(() => new Map(inspection.responses.map((r) => [r.inspectionResponseId, r.itemLabelSnapshot])), [inspection.responses]);
  const evidence = [...inspection.evidence].sort((a, b) => a.displayOrder - b.displayOrder);
  const detailKey = inspectionKeys.detail(inspection.inspectionId);

  const remove = useApiMutation({
    mutationFn: async (e: InspectionEvidenceDto) => {
      try {
        await inspectionsService.detachEvidence(inspection.inspectionId, e.inspectionEvidenceId, inspection.rowVersion);
      } catch (err) {
        if (isConflict(err)) await queryClient.invalidateQueries({ queryKey: detailKey });
        throw err;
      }
    },
    toastOnError: false,
    invalidate: [detailKey],
    successMessage: "Evidence removed.",
    onSuccess: () => setRemoving(null),
  });

  return (
    <SectionCard>
      <PanelTitle title="Evidence" description="Photos and documents captured during the inspection." />
      {evidence.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">No evidence attached yet.</p>
      ) : (
        <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
          {evidence.map((e) => (
            <li key={e.inspectionEvidenceId} className="flex flex-wrap items-start gap-3 px-4 py-3">
              {e.evidenceType === "IMAGE" && e.downloadUrl ? (
                <img src={e.downloadUrl} alt={e.description || "Evidence photo"} loading="lazy" className="size-14 shrink-0 rounded-md bg-surface-muted object-cover" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-muted [&_svg]:size-5">{e.evidenceType === "IMAGE" ? <ImageIcon /> : <FileIcon />}</span>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="break-words">{e.description || (e.evidenceType === "IMAGE" ? "Image" : "Document")}</p>
                <p className="text-xs text-muted-foreground">
                  {e.inspectionResponseId ? `For: ${itemLabel.get(e.inspectionResponseId) ?? "checklist item"}` : "Whole inspection"} · {fmtUtc(e.createdAtUtc)}
                </p>
                <div className="mt-1 text-xs">
                  <PersonText id={e.createdByUserId} names={names} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SignedFileLink url={e.downloadUrl} refresh={() => inspectionsService.evidenceDownloadUrl(inspection.inspectionId, e.inspectionEvidenceId)} />
                {editable && (
                  <RowAction label="Remove evidence" tone="danger" onClick={() => { remove.reset(); setRemoving(e); }}>
                    <TrashIcon />
                  </RowAction>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editable ? <UploadEvidence inspection={inspection} nextOrder={evidence.length} /> : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove evidence?"
        description="The evidence is detached from this inspection."
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      >
        <ApiErrorNotice error={remove.error} />
      </ConfirmDialog>
    </SectionCard>
  );
}

function UploadEvidence({ inspection, nextOrder }: { inspection: InspectionDetailDto; nextOrder: number }) {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [type, setType] = React.useState<InspectionEvidenceType>("IMAGE");
  const [responseId, setResponseId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [progress, setProgress] = React.useState<number | null>(null);
  // Keeps the uploaded file id so a failed attach can be retried without uploading again.
  const [uploadedId, setUploadedId] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const detailKey = inspectionKeys.detail(inspection.inspectionId);

  const mutation = useApiMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file.");
      let fileId = uploadedId;
      if (!fileId) {
        setProgress(0);
        const asset = await filesService.upload(file, INSPECTION_EVIDENCE_FILE_PURPOSE, { onProgress: setProgress });
        fileId = asset.fileId;
        setUploadedId(fileId);
      }
      setProgress(null);
      try {
        return await inspectionsService.attachEvidence(inspection.inspectionId, {
          fileAssetId: fileId,
          inspectionResponseId: responseId || null,
          evidenceType: type,
          description: description.trim() || null,
          displayOrder: nextOrder,
          expectedRowVersion: inspection.rowVersion,
        });
      } catch (e) {
        if (isConflict(e)) await queryClient.invalidateQueries({ queryKey: detailKey });
        throw e;
      }
    },
    toastOnError: false,
    invalidate: [detailKey],
    successMessage: "Evidence attached.",
    onSuccess: () => {
      setFile(null);
      setUploadedId(null);
      setDescription("");
      setResponseId("");
      if (inputRef.current) inputRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    },
  });

  const onFile = (f: File | null) => {
    setUploadedId(null);
    setFileError(null);
    mutation.reset();
    if (f && f.size > limit.maxBytes) {
      setFileError(`The file is larger than ${formatBytes(limit.maxBytes)}.`);
      setFile(null);
      return;
    }
    // inventory-media checks both MIME type and extension (FileAssetService.cs:58-60).
    if (f && !isAllowedFileType(f, INSPECTION_EVIDENCE_FILE_PURPOSE)) {
      setFileError("Use a PDF, JPG, PNG or WebP file (.pdf, .jpg, .jpeg, .png or .webp).");
      setFile(null);
      return;
    }
    setFile(f);
    if (f) setType(f.type === "application/pdf" ? "DOCUMENT" : "IMAGE");
  };

  return (
    <form
      className="@container space-y-3 rounded-lg border border-dashed border-secondary-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) mutation.mutate();
      }}
    >
      <p className="font-heading text-sm font-bold">Add evidence</p>
      <div className="grid gap-3 @lg:grid-cols-2">
        <div className="space-y-2">
          <FormField label="File" htmlFor="evidence-file" required hint={`PDF, JPG, PNG or WebP up to ${formatBytes(limit.maxBytes)}.`} error={fileError ?? undefined}>
            <Input ref={inputRef} type="file" accept={limit.accept} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </FormField>
          {/* Phones/tablets: opens the rear camera directly. Desktops fall back to the file picker. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            hidden
            aria-hidden
            tabIndex={-1}
            data-testid="evidence-camera"
            onChange={(e) => {
              if (inputRef.current) inputRef.current.value = "";
              onFile(e.target.files?.[0] ?? null);
            }}
          />
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => cameraRef.current?.click()}>
            <CameraIcon /> Take photo
          </Button>
          {file && <p className="truncate text-xs text-muted-foreground">Selected: {file.name}</p>}
        </div>
        <FormField label="Type" htmlFor="evidence-type" required>
          <NativeSelect value={type} onChange={(e) => setType(e.target.value as InspectionEvidenceType)}>
            <option value="IMAGE">Image</option>
            <option value="DOCUMENT">Document</option>
          </NativeSelect>
        </FormField>
        <FormField label="Checklist item" htmlFor="evidence-item" hint="Evidence not linked to an item counts for every item that requires evidence.">
          <NativeSelect value={responseId} onChange={(e) => setResponseId(e.target.value)}>
            <option value="">Whole inspection</option>
            {inspection.responses.map((r) => (
              <option key={r.inspectionResponseId} value={r.inspectionResponseId}>
                {r.itemLabelSnapshot}
                {r.requiresEvidenceSnapshot ? " (evidence required)" : ""}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Description" htmlFor="evidence-description" hint={`${description.length}/500`}>
          <Input maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
      </div>
      {progress !== null && mutation.isPending && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="h-full bg-action-border transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {uploadedId && mutation.error ? <Notice>The file was uploaded; retrying will only re-attach it.</Notice> : null}
      <ApiErrorNotice error={mutation.error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!file} loading={mutation.isPending}>
          <UploadSimpleIcon /> {uploadedId ? "Retry attach" : "Upload and attach"}
        </Button>
      </div>
    </form>
  );
}
