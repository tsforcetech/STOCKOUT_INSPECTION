import * as React from "react";
import { CameraIcon, CheckCircleIcon, FileIcon, ImageIcon, SpinnerGapIcon, TrashIcon, UploadSimpleIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatBytes } from "@/lib/utils/format";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import type { InspectionDetailDto, InspectionEvidenceDto } from "@/api/types/catalog-moderation";
import { INSPECTION_EVIDENCE_FILE_PURPOSE } from "@/api/types/catalog-moderation";
import { inspectionsService } from "@/services/inspections.service";
import { filesService, FILE_LIMITS, isAllowedFileType } from "@/services/files.service";
import { ApiErrorNotice, PanelTitle, SignedFileLink, fmtUtc } from "@/features/listings/shared";
import { useInspectionWriter } from "./writer";

const limit = FILE_LIMITS[INSPECTION_EVIDENCE_FILE_PURPOSE];
const CLEAN_LABEL = /^\[CRITICAL\]\s*/i;
export const itemName = (label: string) => label.replace(CLEAN_LABEL, "");

/* ---------- Upload queue (shared by the Photos step and the camera button on each checklist item) ---------- */

export interface Upload {
  key: string;
  name: string;
  preview: string | null;
  responseId: string | null;
  progress: number;
  state: "uploading" | "attaching" | "done" | "error";
  error?: string;
  file: File;
  description: string | null;
  /** Kept after a successful upload so a failed attach is retried without uploading again. */
  fileId?: string;
}

interface Uploads {
  items: Upload[];
  add: (files: File[], opts?: { responseId?: string | null; description?: string | null }) => void;
  retry: (key: string) => void;
  dismiss: (key: string) => void;
}

const UploadsContext = React.createContext<Uploads | null>(null);

export function PhotoUploadsProvider({ inspection, children }: { inspection: InspectionDetailDto; children: React.ReactNode }) {
  const writer = useInspectionWriter();
  const [items, setItems] = React.useState<Upload[]>([]);
  const order = React.useRef(0);
  const patch = React.useCallback((key: string, p: Partial<Upload>) => setItems((list) => list.map((u) => (u.key === key ? { ...u, ...p } : u))), []);

  const process = React.useCallback(
    async (u: Upload) => {
      try {
        let fileId = u.fileId;
        if (!fileId) {
          patch(u.key, { state: "uploading", progress: 0, error: undefined });
          const asset = await filesService.upload(u.file, INSPECTION_EVIDENCE_FILE_PURPOSE, { onProgress: (p) => patch(u.key, { progress: p }) });
          fileId = asset.fileId;
          patch(u.key, { fileId });
        }
        patch(u.key, { state: "attaching", progress: 1, error: undefined });
        const id = fileId;
        await writer.run((rv) =>
          inspectionsService.attachEvidence(inspection.inspectionId, {
            fileAssetId: id,
            inspectionResponseId: u.responseId,
            // Type follows the file: PDFs are documents, everything else is a photo.
            evidenceType: u.file.type === "application/pdf" ? "DOCUMENT" : "IMAGE",
            description: u.description,
            displayOrder: inspection.evidence.length + order.current++,
            expectedRowVersion: rv,
          }),
        );
        patch(u.key, { state: "done" });
        window.setTimeout(() => setItems((list) => list.filter((x) => x.key !== u.key)), 2500);
      } catch (e) {
        patch(u.key, { state: "error", error: getErrorMessage(e) });
      }
    },
    [writer, inspection.inspectionId, inspection.evidence.length, patch],
  );

  const add = React.useCallback<Uploads["add"]>(
    (files, opts) => {
      for (const file of files) {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const base: Upload = {
          key,
          name: file.name,
          file,
          preview: file.type.startsWith("image/") && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null,
          responseId: opts?.responseId ?? null,
          description: opts?.description?.trim() || null,
          progress: 0,
          state: "uploading",
        };
        // Same checks as inventory-media (MIME type + extension, size) so the inspector learns at once.
        const problem = file.size > limit.maxBytes ? `Larger than ${formatBytes(limit.maxBytes)}.` : !isAllowedFileType(file, INSPECTION_EVIDENCE_FILE_PURPOSE) ? "Use a JPG, PNG, WebP or PDF file." : null;
        setItems((list) => [...list, problem ? { ...base, state: "error", error: problem } : base]);
        if (!problem) void process(base);
      }
    },
    [process],
  );

  const retry = React.useCallback(
    (key: string) => {
      const u = items.find((x) => x.key === key);
      if (u) void process(u);
    },
    [items, process],
  );
  const dismiss = React.useCallback((key: string) => setItems((list) => list.filter((x) => x.key !== key)), []);
  const value = React.useMemo(() => ({ items, add, retry, dismiss }), [items, add, retry, dismiss]);
  return <UploadsContext.Provider value={value}>{children}</UploadsContext.Provider>;
}

export function usePhotoUploads(): Uploads {
  const u = React.useContext(UploadsContext);
  if (!u) throw new Error("usePhotoUploads needs <PhotoUploadsProvider>");
  return u;
}

/** Hidden file input + a function that opens it. `camera` opens the rear camera on phones and tablets. */
function useFilePicker(onFiles: (files: File[]) => void, opts: { camera?: boolean; multiple?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      hidden
      aria-hidden
      tabIndex={-1}
      multiple={opts.multiple}
      accept={opts.camera ? "image/jpeg,image/png,image/webp" : limit.accept}
      capture={opts.camera ? "environment" : undefined}
      data-testid={opts.camera ? "camera-input" : "file-input"}
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length) onFiles(files);
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
}

/* ---------- Camera button on a checklist item ---------- */

export function ItemPhotoButton({ inspection, responseId, required, highlight }: { inspection: InspectionDetailDto; responseId: string; required: boolean; highlight?: boolean }) {
  const uploads = usePhotoUploads();
  const picker = useFilePicker((files) => uploads.add(files, { responseId }), { camera: true });
  const stored = inspection.evidence.filter((e) => e.inspectionResponseId === responseId).length;
  const busy = uploads.items.some((u) => u.responseId === responseId && (u.state === "uploading" || u.state === "attaching"));
  const failed = uploads.items.some((u) => u.responseId === responseId && u.state === "error");
  return (
    <>
      {picker.input}
      <button
        type="button"
        onClick={picker.open}
        className={cn(
          "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors [&_svg]:size-4",
          stored > 0
            ? "border-success/40 bg-success-soft text-success-soft-foreground"
            : required || highlight
              ? "border-info-soft-foreground/30 bg-info-soft text-info-soft-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground",
        )}
      >
        {busy ? <SpinnerGapIcon className="animate-spin" /> : stored > 0 ? <CheckCircleIcon weight="fill" /> : <CameraIcon />}
        {busy ? "Uploading…" : stored > 0 ? `${stored} photo${stored === 1 ? "" : "s"} · add` : required ? "Photo required" : "Add photo"}
      </button>
      {failed && <span className="text-xs text-danger">Upload failed. See Photos.</span>}
    </>
  );
}

/* ---------- Photos step ---------- */

function UploadRow({ u }: { u: Upload }) {
  const uploads = usePhotoUploads();
  return (
    <li className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted">
      {u.preview ? <img src={u.preview} alt="" className="size-full object-cover opacity-70" /> : <FileIcon className="m-auto mt-8 size-8 text-muted-foreground" />}
      <div className="absolute inset-x-0 bottom-0 bg-surface/90 p-2 text-xs">
        {u.state === "error" ? (
          <div className="space-y-1">
            <p className="flex items-start gap-1 text-danger">
              <WarningCircleIcon className="mt-px size-4 shrink-0" /> <span className="line-clamp-2">{u.error}</span>
            </p>
            <div className="flex gap-1">
              {u.file.size <= limit.maxBytes && isAllowedFileType(u.file, INSPECTION_EVIDENCE_FILE_PURPOSE) && (
                <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => uploads.retry(u.key)}>
                  Retry
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => uploads.dismiss(u.key)} aria-label="Dismiss">
                <XIcon />
              </Button>
            </div>
          </div>
        ) : u.state === "done" ? (
          <p className="flex items-center gap-1 text-success">
            <CheckCircleIcon weight="fill" className="size-4" /> Saved
          </p>
        ) : (
          <div role="progressbar" aria-label={`Uploading ${u.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.progress * 100)}>
            <p className="mb-1 truncate">{u.state === "attaching" ? "Saving…" : `Uploading ${Math.round(u.progress * 100)}%`}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full bg-action-border transition-all" style={{ width: `${Math.round(u.progress * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function EvidenceTile({ e, label, editable, onRemove, inspectionId }: { e: InspectionEvidenceDto; label: string; editable: boolean; onRemove: () => void; inspectionId: string }) {
  return (
    <li className="group relative overflow-hidden rounded-lg border border-border bg-surface">
      <div className="aspect-square bg-surface-muted">
        {e.evidenceType === "IMAGE" && e.downloadUrl ? (
          <img src={e.downloadUrl} alt={e.description || label} loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground [&_svg]:size-10">{e.evidenceType === "IMAGE" ? <ImageIcon /> : <FileIcon />}</span>
        )}
      </div>
      <div className="space-y-0.5 p-2 text-xs">
        <p className="truncate font-medium text-foreground" title={label}>
          {label}
        </p>
        {e.description && <p className="truncate text-muted-foreground">{e.description}</p>}
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-muted-foreground">{fmtUtc(e.createdAtUtc)}</span>
          <SignedFileLink url={e.downloadUrl} refresh={() => inspectionsService.evidenceDownloadUrl(inspectionId, e.inspectionEvidenceId)} />
        </div>
      </div>
      {editable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove photo"
          className="absolute right-1.5 top-1.5 flex size-8 cursor-pointer items-center justify-center rounded-full bg-surface/90 text-danger shadow-sm hover:bg-surface"
        >
          <TrashIcon className="size-4" />
        </button>
      )}
    </li>
  );
}

export function PhotosPanel({ inspection, editable }: { inspection: InspectionDetailDto; editable: boolean }) {
  const writer = useInspectionWriter();
  const uploads = usePhotoUploads();
  const [responseId, setResponseId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<InspectionEvidenceDto | null>(null);
  const addFiles = (files: File[]) => {
    uploads.add(files, { responseId: responseId || null, description });
    setDescription("");
  };
  const camera = useFilePicker(addFiles, { camera: true });
  const picker = useFilePicker(addFiles, { multiple: true });
  const itemLabel = React.useMemo(() => new Map(inspection.responses.map((r) => [r.inspectionResponseId, itemName(r.itemLabelSnapshot)])), [inspection.responses]);
  const evidence = [...inspection.evidence].sort((a, b) => a.displayOrder - b.displayOrder);
  const needsPhoto = inspection.responses.filter((r) => r.requiresEvidenceSnapshot);
  const missing = needsPhoto.filter((r) => !inspection.evidence.some((e) => e.inspectionResponseId === r.inspectionResponseId));
  const generalCount = inspection.evidence.filter((e) => !e.inspectionResponseId).length;

  const remove = useApiMutation({
    mutationFn: (e: InspectionEvidenceDto) => writer.run((rv) => inspectionsService.detachEvidence(inspection.inspectionId, e.inspectionEvidenceId, rv)),
    toastOnError: false,
    successMessage: "Photo removed.",
    onSuccess: () => setRemoving(null),
  });

  return (
    <SectionCard>
      <PanelTitle title="Photos & documents" description={editable ? "Take photos on site or upload files. Photos taken from a checklist item are linked to it automatically." : undefined} />
      {needsPhoto.length > 0 && (
        <div className={cn("mb-4 rounded-lg border p-3 text-sm", missing.length ? "border-warning/40 bg-warning-soft text-warning-soft-foreground" : "border-success/40 bg-success-soft text-success-soft-foreground")}>
          {missing.length === 0 ? (
            "Every item that needs a photo has one."
          ) : (
            <>
              <p className="font-medium">
                {missing.length} item{missing.length === 1 ? " needs" : "s need"} a photo{generalCount > 0 ? " (general photos also count for them)" : ""}:
              </p>
              <p className="mt-0.5">{missing.map((r) => itemName(r.itemLabelSnapshot)).join(" · ")}</p>
            </>
          )}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {editable && (
          <>
            <li>
              {camera.input}
              <button
                type="button"
                onClick={camera.open}
                className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-action-border bg-action-soft text-sm font-semibold text-foreground transition-colors hover:bg-action-soft-strong"
              >
                <CameraIcon className="size-9" /> Take photo
              </button>
            </li>
            <li>
              {picker.input}
              <button
                type="button"
                onClick={picker.open}
                className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
              >
                <UploadSimpleIcon className="size-9" /> Upload files
                <span className="px-2 text-center text-[11px] font-normal text-muted-foreground">JPG, PNG, WebP, PDF · up to {formatBytes(limit.maxBytes)}</span>
              </button>
            </li>
          </>
        )}
        {uploads.items.map((u) => (
          <UploadRow key={u.key} u={u} />
        ))}
        {evidence.map((e) => (
          <EvidenceTile
            key={e.inspectionEvidenceId}
            e={e}
            inspectionId={inspection.inspectionId}
            label={e.inspectionResponseId ? (itemLabel.get(e.inspectionResponseId) ?? "Checklist item") : "General"}
            editable={editable}
            onRemove={() => {
              remove.reset();
              setRemoving(e);
            }}
          />
        ))}
      </ul>
      {!editable && evidence.length === 0 && <p className="text-sm text-muted-foreground">No photos or documents.</p>}

      {editable && (
        <div className="mt-4">
          <button type="button" className="cursor-pointer text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((o) => !o)}>
            {optionsOpen ? "Hide options" : "Options: link to an item, add a caption"}
          </button>
          {optionsOpen && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <NativeSelect aria-label="Link the next photo to" value={responseId} onChange={(e) => setResponseId(e.target.value)}>
                <option value="">General photo (whole inspection)</option>
                {inspection.responses.map((r) => (
                  <option key={r.inspectionResponseId} value={r.inspectionResponseId}>
                    {itemName(r.itemLabelSnapshot)}
                    {r.requiresEvidenceSnapshot ? " (photo required)" : ""}
                  </option>
                ))}
              </NativeSelect>
              <Input aria-label="Caption for the next photo" placeholder="Caption (optional)" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this photo?"
        description="It is detached from this inspection."
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      >
        <ApiErrorNotice error={remove.error} />
      </ConfirmDialog>
    </SectionCard>
  );
}
