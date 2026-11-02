import * as React from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { CaretDownIcon, CheckIcon, ChecksIcon, NotePencilIcon, XIcon } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ItemPhotoButton } from "./evidence";
import { useInspectionWriter } from "./writer";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { FilterPills } from "@/components/common/filter-pills";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { useAccess } from "@/lib/auth/use-access";
import { cn } from "@/lib/utils/cn";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import type { InspectionDetailDto, InspectionItemResult, InspectionResponseDto, SaveInspectionResponseItem } from "@/api/types/catalog-moderation";
import { inspectionsService } from "@/services/inspections.service";
import { ApiErrorNotice, Notice, PanelTitle, fmtUtc } from "@/features/listings/shared";
import { inspectionKeys } from "../queries";

/* allowedOptionsJson has no backend-defined structure. Accept the common shapes; otherwise free text. */
export function parseOptions(json: string | null | undefined): string[] | null {
  if (!json) return null;
  try {
    const raw: unknown = JSON.parse(json);
    const list: unknown = Array.isArray(raw) ? raw : typeof raw === "object" && raw !== null && "options" in raw ? (raw as { options: unknown }).options : null;
    if (!Array.isArray(list)) return null;
    const values = list
      .map((o: unknown) => {
        if (typeof o === "string" || typeof o === "number") return String(o);
        if (typeof o === "object" && o !== null) {
          const r = o as Record<string, unknown>;
          const v = r.value ?? r.code ?? r.label ?? r.name;
          return typeof v === "string" || typeof v === "number" ? String(v) : null;
        }
        return null;
      })
      .filter((v): v is string => v !== null && v !== "");
    return values.length ? values : null;
  } catch {
    return null;
  }
}

function parseMulti(json: string | null): string[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

interface ItemValues {
  id: string;
  passFail: string;
  yesNo: "" | "true" | "false";
  text: string;
  number: string;
  single: string;
  multi: string[];
  multiText: string;
  notes: string;
  itemResult: "" | InspectionItemResult;
}
interface FormValues {
  items: ItemValues[];
}

const toValues = (r: InspectionResponseDto): ItemValues => ({
  id: r.inspectionResponseId,
  passFail: r.passFailValue ?? "",
  yesNo: r.yesNoValue === null ? "" : r.yesNoValue ? "true" : "false",
  text: r.textValue ?? "",
  number: r.numberValue === null ? "" : String(r.numberValue),
  single: r.singleSelectValue ?? "",
  multi: parseMulti(r.multiSelectValueJson),
  multiText: parseMulti(r.multiSelectValueJson).join(", "),
  notes: r.inspectorNotes ?? "",
  itemResult: r.itemResult ?? "",
});

function toPayload(r: InspectionResponseDto, v: ItemValues, options: string[] | null): SaveInspectionResponseItem {
  const base: SaveInspectionResponseItem = { inspectionResponseId: r.inspectionResponseId, inspectorNotes: v.notes.trim() || null, itemResult: v.itemResult || null };
  switch (r.responseTypeSnapshot) {
    case "PASS_FAIL":
      return { ...base, passFailValue: v.passFail || null };
    case "YES_NO":
      return { ...base, yesNoValue: v.yesNo === "" ? null : v.yesNo === "true" };
    case "TEXT":
      return { ...base, textValue: v.text.trim() || null };
    case "NUMBER":
      return { ...base, numberValue: v.number.trim() === "" ? null : Number(v.number) };
    case "SINGLE_SELECT":
      return { ...base, singleSelectValue: v.single || null };
    case "MULTI_SELECT": {
      const list = options ? v.multi : v.multiText.split(",").map((s) => s.trim()).filter(Boolean);
      return { ...base, multiSelectValueJson: list.length ? JSON.stringify(list) : null };
    }
  }
}

/** Did the server's returned row reflect what we sent? */
function reflects(sent: SaveInspectionResponseItem, got: InspectionResponseDto | undefined): boolean {
  if (!got) return false;
  return (
    (sent.itemResult ?? null) === got.itemResult &&
    (sent.inspectorNotes ?? null) === got.inspectorNotes &&
    (sent.passFailValue === undefined || sent.passFailValue === got.passFailValue) &&
    (sent.yesNoValue === undefined || sent.yesNoValue === got.yesNoValue) &&
    (sent.textValue === undefined || sent.textValue === got.textValue) &&
    (sent.numberValue === undefined || sent.numberValue === got.numberValue) &&
    (sent.singleSelectValue === undefined || sent.singleSelectValue === got.singleSelectValue) &&
    (sent.multiSelectValueJson === undefined || JSON.stringify(parseMulti(sent.multiSelectValueJson)) === JSON.stringify(parseMulti(got.multiSelectValueJson)))
  );
}

function answerText(r: InspectionResponseDto): string {
  switch (r.responseTypeSnapshot) {
    case "PASS_FAIL":
      return r.passFailValue ?? "—";
    case "YES_NO":
      return r.yesNoValue === null ? "—" : r.yesNoValue ? "Yes" : "No";
    case "TEXT":
      return r.textValue ?? "—";
    case "NUMBER":
      return r.numberValue === null ? "—" : String(r.numberValue);
    case "SINGLE_SELECT":
      return r.singleSelectValue ?? "—";
    case "MULTI_SELECT": {
      const l = parseMulti(r.multiSelectValueJson);
      return l.length ? l.join(", ") : "—";
    }
  }
}

/* ---------- Sections ---------- */

const SECTION_NAMES: Record<string, string> = { HDR: "General", SUM: "Summary" };
const CRITICAL = /^\[CRITICAL\]\s*/i;

interface Section {
  key: string;
  title: string;
  /** Shared description of every item in the section (shown once, under the title). */
  note: string | null;
  /** Per item, what is left of its description once the shared part is shown on the section. */
  extra: Map<string, string>;
  rows: Array<{ r: InspectionResponseDto; i: number }>;
}

/** Groups items by their code prefix (DOC_1, DOC_2 → DOC). Items without a prefix share one section. */
export function buildSections(responses: InspectionResponseDto[]): Section[] {
  const sections: Section[] = [];
  responses.forEach((r, i) => {
    const key = /^([A-Za-z0-9]+)_/.exec(r.itemCodeSnapshot)?.[1]?.toUpperCase() ?? "";
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.rows.push({ r, i });
    else sections.push({ key, title: "", note: null, extra: new Map(), rows: [{ r, i }] });
  });
  for (const s of sections) {
    // Shared = the leading sentences every item's description starts with.
    const split = s.rows.map(({ r }) => (r.itemDescriptionSnapshot ?? "").split(/(?<=\.)\s+/).filter(Boolean));
    let k = 0;
    while (s.rows.length > 1 && split.every((x) => x.length > k && x[k] === split[0][k])) k++;
    const shared = k ? split[0].slice(0, k).join(" ") : null;
    if (shared) s.rows.forEach(({ r }, n) => s.extra.set(r.inspectionResponseId, split[n].slice(k).join(" ")));
    // "Documentation & Compliance (weight 15%). Score 5-1 or NA." → title "Documentation & Compliance", note "Weight 15% · Score 5-1 or NA."
    const m = shared ? /^([^(.]+?)\s*\(([^)]*)\)\.?\s*(.*)$/.exec(shared) : null;
    s.title = m ? m[1] : (SECTION_NAMES[s.key] ?? (s.key || "Checklist"));
    s.note = m ? [m[2].replace(/^./, (c) => c.toUpperCase()), m[3]].filter(Boolean).join(" · ") : shared;
  }
  return sections;
}

const describe = (s: Section, r: InspectionResponseDto) => (s.extra.has(r.inspectionResponseId) ? s.extra.get(r.inspectionResponseId) || null : r.itemDescriptionSnapshot);

/* ---------- Result suggestions ---------- */

/** One tap should be enough: an answer that implies a result fills an empty result in. */
export function suggestedResult(r: InspectionResponseDto, v: ItemValues): InspectionItemResult | null {
  if (r.responseTypeSnapshot === "PASS_FAIL") return v.passFail === "PASS" ? "PASS" : v.passFail === "FAIL" ? "FAIL" : null;
  if (r.responseTypeSnapshot === "SINGLE_SELECT") {
    const a = v.single.trim();
    if (/^N\/?A\b/i.test(a)) return "NOT_APPLICABLE";
    const score = /^([1-5])\b/.exec(a)?.[1];
    if (score) return Number(score) >= 3 ? "PASS" : "FAIL";
  }
  return null;
}

/* ---------- Controls ---------- */

type Tone = "success" | "danger" | "neutral" | "action";
const toneOn: Record<Tone, string> = {
  success: "border-success bg-success text-white",
  danger: "border-danger bg-danger text-white",
  neutral: "border-foreground bg-foreground text-surface",
  action: "border-action-border bg-action text-action-foreground",
};

interface Choice {
  value: string;
  label: React.ReactNode;
  title?: string;
  tone?: Tone;
}

/** Radio-style buttons. Tapping the selected one again clears it. */
function Choices({ choices, value, onChange, label, multi, disabled, wrap }: { choices: Choice[]; value: string | string[]; onChange: (v: string) => void; label: string; multi?: boolean; disabled?: boolean; wrap?: boolean }) {
  const isOn = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={label} className={cn("flex gap-1.5", wrap ? "flex-wrap" : "flex-nowrap")}>
      {choices.map((c) => {
        const on = isOn(c.value);
        return (
          <button
            key={c.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            title={c.title}
            disabled={disabled}
            onClick={() => onChange(c.value)}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              on ? toneOn[c.tone ?? "neutral"] : "border-border bg-surface text-foreground hover:border-foreground/40",
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

const RESULT_CHOICES: Choice[] = [
  { value: "PASS", label: <><CheckIcon weight="bold" aria-hidden /> Pass</>, tone: "success" },
  { value: "FAIL", label: <><XIcon weight="bold" aria-hidden /> Fail</>, tone: "danger" },
  { value: "NOT_APPLICABLE", label: "N/A", title: "Not applicable", tone: "neutral" },
];

/** "3 - Fair (usable, must disclose)" → chip "3 · Fair", full text as the tooltip. */
function optionChoice(o: string): Choice {
  const m = /^([0-9]+|N\/?A)\s*[-–:]\s*(.+)$/i.exec(o);
  if (!m) return { value: o, label: o, title: o };
  const short = m[2].split(/\s*[(/]/)[0].trim();
  return { value: o, title: o, label: m[1].toUpperCase() === "NA" || m[1].toUpperCase() === "N/A" ? "N/A" : <><span className="font-bold">{m[1]}</span> {short}</> };
}

const MAX_CHIPS = 8;

function AnswerInput({ r, i, options, form, numberError }: { r: InspectionResponseDto; i: number; options: string[] | null; form: UseFormReturn<FormValues>; numberError?: string }) {
  const id = `answer-${r.inspectionResponseId}`;
  const v = form.watch(`items.${i}`);
  const set = <K extends keyof ItemValues>(key: K, value: ItemValues[K]) => {
    form.setValue(`items.${i}.${key}` as `items.${number}.${K}`, value as never, { shouldDirty: true });
    const next = { ...form.getValues(`items.${i}`), [key]: value };
    const hint = suggestedResult(r, next);
    if (hint && !next.itemResult) form.setValue(`items.${i}.itemResult`, hint, { shouldDirty: true });
  };
  const label = `Answer: ${r.itemLabelSnapshot.replace(CRITICAL, "")}`;
  switch (r.responseTypeSnapshot) {
    case "PASS_FAIL":
      return null; // answered by the result buttons
    case "YES_NO":
      return (
        <Choices
          label={label}
          value={v.yesNo}
          onChange={(x) => set("yesNo", v.yesNo === x ? "" : (x as ItemValues["yesNo"]))}
          choices={[
            { value: "true", label: "Yes", tone: "action" },
            { value: "false", label: "No", tone: "action" },
          ]}
        />
      );
    case "TEXT":
      return <Textarea id={id} aria-label={label} rows={1} maxLength={2000} placeholder="Type the answer…" className="min-h-10 [field-sizing:content]" {...form.register(`items.${i}.text`)} />;
    case "NUMBER":
      return (
        <div>
          <Input id={id} aria-label={label} type="number" step="any" inputMode="decimal" placeholder="0" className="w-full sm:w-48" aria-invalid={!!numberError} {...form.register(`items.${i}.number`)} />
          {numberError && <p className="mt-1 text-xs text-danger">{numberError}</p>}
        </div>
      );
    case "SINGLE_SELECT":
      if (!options) return <Input id={id} aria-label={label} placeholder="Enter the value (options unavailable)" {...form.register(`items.${i}.single`)} />;
      if (options.length > MAX_CHIPS)
        return (
          <NativeSelect id={id} aria-label={label} value={v.single} onChange={(e) => set("single", e.target.value)}>
            <option value="">Not answered</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </NativeSelect>
        );
      return <Choices wrap label={label} value={v.single} onChange={(x) => set("single", v.single === x ? "" : x)} choices={options.map((o) => ({ ...optionChoice(o), tone: "action" }))} />;
    case "MULTI_SELECT":
      if (!options) return <Input id={id} aria-label={label} placeholder="Comma-separated values (options unavailable)" {...form.register(`items.${i}.multiText`)} />;
      return (
        <Choices
          wrap
          multi
          label={label}
          value={v.multi}
          onChange={(x) => set("multi", v.multi.includes(x) ? v.multi.filter((m) => m !== x) : [...v.multi, x])}
          choices={options.map((o) => ({ ...optionChoice(o), tone: "action" }))}
        />
      );
  }
}

/* ---------- Item ---------- */

const resultBar: Record<string, string> = { PASS: "before:bg-success", FAIL: "before:bg-danger", NOT_APPLICABLE: "before:bg-muted-foreground/50" };

function ItemTitle({ r, description, editable }: { r: InspectionResponseDto; description: string | null; editable?: boolean }) {
  const critical = CRITICAL.test(r.itemLabelSnapshot);
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium leading-snug text-foreground">
        {r.itemLabelSnapshot.replace(CRITICAL, "")}
        {r.isRequiredSnapshot && (
          <span className="ml-0.5 text-danger" aria-label="required">
            *
          </span>
        )}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
        {critical && <Badge tone="danger">Critical</Badge>}
        {r.requiresEvidenceSnapshot && !editable && <Badge tone="info">Photo required</Badge>}
      </div>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

function EditableItem({
  r,
  i,
  options,
  form,
  description,
  numberError,
  inspection,
  onAnswered,
}: {
  r: InspectionResponseDto;
  i: number;
  options: string[] | null;
  form: UseFormReturn<FormValues>;
  description: string | null;
  numberError?: string;
  inspection: InspectionDetailDto;
  onAnswered: (i: number) => void;
}) {
  const v = form.watch(`items.${i}`);
  const [noteOpen, setNoteOpen] = React.useState(() => !!v.notes);
  const isPassFail = r.responseTypeSnapshot === "PASS_FAIL";
  const failed = v.itemResult === "FAIL";
  const setResult = (x: string) => {
    const next = (v.itemResult === x ? "" : x) as ItemValues["itemResult"];
    form.setValue(`items.${i}.itemResult`, next, { shouldDirty: true });
    if (isPassFail) form.setValue(`items.${i}.passFail`, next === "PASS" || next === "FAIL" ? next : "", { shouldDirty: true });
    if (next === "FAIL") setNoteOpen(true);
    else if (next) onAnswered(i);
  };
  const answer = <AnswerInput r={r} i={i} options={options} form={form} numberError={numberError} />;
  return (
    <li
      data-item={i}
      className={cn(
        "relative scroll-mt-40 space-y-3 overflow-hidden rounded-lg border border-border bg-surface p-3 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-1 sm:p-4 sm:pl-5",
        resultBar[v.itemResult] ?? "before:bg-transparent",
        failed && "border-danger/40",
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <ItemTitle r={r} description={description} editable />
        <div className="shrink-0 [&_button]:min-h-11 [&_button]:px-4 [&_button]:text-base md:[&_button]:min-h-9 md:[&_button]:px-3 md:[&_button]:text-sm">
          <Choices label={`Result: ${r.itemLabelSnapshot.replace(CRITICAL, "")}`} value={v.itemResult} onChange={setResult} choices={RESULT_CHOICES} />
        </div>
      </div>
      {answer}
      {noteOpen ? (
        <Textarea
          aria-label={`Inspector notes: ${r.itemLabelSnapshot.replace(CRITICAL, "")}`}
          rows={2}
          maxLength={2000}
          placeholder={failed ? "What is wrong? (helps the seller and the reviewer)" : "Inspector notes"}
          autoFocus={!v.notes}
          {...form.register(`items.${i}.notes`)}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <ItemPhotoButton inspection={inspection} responseId={r.inspectionResponseId} required={r.requiresEvidenceSnapshot} highlight={failed} />
        {!noteOpen && (
          <button type="button" onClick={() => setNoteOpen(true)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
            <NotePencilIcon aria-hidden className="size-4" /> Add note
          </button>
        )}
      </div>
    </li>
  );
}

/* ---------- Panel ---------- */

type View = "all" | "todo" | "failed";

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {done}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className={cn("h-full rounded-full transition-all", done === total && total > 0 ? "bg-success" : "bg-action")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const AUTOSAVE_MS = 800;

export function ChecklistPanel({ inspection, editable }: { inspection: InspectionDetailDto; editable: boolean }) {
  const { can } = useAccess();
  const responses = React.useMemo(() => [...inspection.responses].sort((a, b) => a.displayOrderSnapshot - b.displayOrderSnapshot), [inspection.responses]);
  const sections = React.useMemo(() => buildSections(responses), [responses]);
  const canReadTemplate = can(P.INSPECTIONS_TEMPLATES_MANAGE);
  const template = useQuery({
    queryKey: inspectionKeys.template(inspection.inspectionChecklistTemplateId),
    queryFn: ({ signal }) => inspectionsService.template(inspection.inspectionChecklistTemplateId, signal),
    enabled: editable && canReadTemplate,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const optionsFor = React.useCallback(
    (r: InspectionResponseDto) => parseOptions(template.data?.items.find((t) => t.inspectionChecklistTemplateItemId === r.sourceTemplateItemId)?.allowedOptionsJson),
    [template.data],
  );

  // Initialised once per inspection: refetches never overwrite what the inspector has typed.
  const form = useForm<FormValues>({ defaultValues: { items: responses.map(toValues) } });
  const initialRemaining = React.useRef(responses.filter((r) => !r.itemResult).length);
  const [view, setView] = React.useState<View>(() => (editable && initialRemaining.current > 0 && initialRemaining.current < responses.length ? "todo" : "all"));
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [confirmAllPass, setConfirmAllPass] = React.useState<Array<{ r: InspectionResponseDto; i: number }> | null>(null);
  const live = form.watch("items");
  const listRef = React.useRef<HTMLDivElement>(null);

  /* ----- Autosave: every change is stored automatically, one request at a time. ----- */
  const writer = useInspectionWriter();
  const { setSaveState } = writer;
  const [error, setError] = React.useState<unknown>(null);
  const [notPersisted, setNotPersisted] = React.useState(0);
  const lastSaved = React.useRef(JSON.stringify(responses.map(toValues)));
  const saving = React.useRef(false);
  const liveJson = JSON.stringify(live);

  const saveNow = React.useCallback(async () => {
    if (saving.current) return;
    const values = form.getValues();
    const json = JSON.stringify(values.items);
    if (json === lastSaved.current) {
      setSaveState("saved");
      return;
    }
    let ok = true;
    responses.forEach((r, i) => {
      const n = values.items[i].number;
      if (r.responseTypeSnapshot === "NUMBER" && n.trim() !== "" && !Number.isFinite(Number(n))) {
        form.setError(`items.${i}.number`, { message: "Enter a number." });
        ok = false;
      }
    });
    if (!ok) {
      setSaveState("error");
      return;
    }
    saving.current = true;
    setSaveState("saving");
    const payload = responses.map((r, i) => toPayload(r, values.items[i], optionsFor(r)));
    try {
      const result = await writer.run(
        (rv) => inspectionsService.saveResponses(inspection.inspectionId, { expectedRowVersion: rv, responses: payload }),
        (res) => res.rowVersion,
      );
      const byId = new Map(result.responses.map((x) => [x.inspectionResponseId, x]));
      const missing = payload.filter((p) => !reflects(p, byId.get(p.inspectionResponseId))).length;
      setNotPersisted(missing);
      setError(null);
      if (missing === 0) lastSaved.current = json;
      saving.current = false;
      // Anything typed while this save was in flight is saved next.
      if (JSON.stringify(form.getValues().items) !== lastSaved.current && missing === 0) void saveNow();
      else setSaveState(missing ? "error" : "saved");
    } catch (e) {
      saving.current = false;
      setError(e);
      setSaveState("error");
    }
  }, [form, responses, optionsFor, writer, inspection.inspectionId, setSaveState]);

  React.useEffect(() => {
    if (!editable || liveJson === lastSaved.current) return;
    setSaveState("pending");
    const t = window.setTimeout(() => void saveNow(), AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [liveJson, editable, saveNow, setSaveState]);

  // Save straight away when the inspector leaves the page or switches app.
  React.useEffect(() => {
    if (!editable) return;
    const flush = () => {
      if (document.visibilityState === "hidden") void saveNow();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [editable, saveNow]);

  const storedRequired = responses.filter((r) => r.isRequiredSnapshot && r.itemResult).length;
  const required = responses.filter((r) => r.isRequiredSnapshot).length;

  if (responses.length === 0)
    return (
      <SectionCard>
        <PanelTitle title="Checklist" />
        <p className="text-sm text-muted-foreground">This inspection has no checklist items.</p>
      </SectionCard>
    );

  if (!editable) return <ReadOnlyChecklist responses={responses} sections={sections} storedRequired={storedRequired} required={required} />;

  const resultOf = (i: number) => live?.[i]?.itemResult ?? "";
  const done = responses.filter((_, i) => resultOf(i)).length;
  const failed = responses.filter((_, i) => resultOf(i) === "FAIL").length;
  const matches = (_r: InspectionResponseDto, i: number) => view === "all" || (view === "todo" && !resultOf(i)) || (view === "failed" && resultOf(i) === "FAIL");
  const passRemaining = (rows: Array<{ r: InspectionResponseDto; i: number }>) => {
    for (const { r, i } of rows) {
      if (resultOf(i)) continue;
      form.setValue(`items.${i}.itemResult`, "PASS", { shouldDirty: true });
      if (r.responseTypeSnapshot === "PASS_FAIL") form.setValue(`items.${i}.passFail`, "PASS", { shouldDirty: true });
    }
  };
  const all = responses.map((r, i) => ({ r, i }));
  const remaining = responses.length - done;

  /** After an answer, bring the next unanswered item into view (in "To do" the answered one drops out of the list). */
  const onAnswered = (i: number) => {
    window.setTimeout(() => {
      const items = form.getValues().items;
      const next = responses.findIndex((_, k) => k > i && !items[k].itemResult);
      const el = next >= 0 ? listRef.current?.querySelector<HTMLElement>(`[data-item="${next}"]`) : null;
      el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 150);
  };

  return (
    <SectionCard>
      <PanelTitle
        title="Checklist"
        description={`${done} of ${responses.length} answered · answers save automatically.`}
        actions={
          remaining > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmAllPass(all)}>
              <ChecksIcon aria-hidden /> Mark remaining {remaining} as Pass
            </Button>
          )
        }
      />
      <div ref={listRef} className="space-y-4">
        <FilterPills
          label="Checklist view"
          value={view}
          onChange={(x) => setView(x as View)}
          items={[
            { value: "todo", label: "To do", count: remaining, highlight: remaining > 0 },
            { value: "failed", label: "Failed", count: failed },
            { value: "all", label: "All", count: responses.length },
          ]}
        />
        {canReadTemplate && template.error ? <Notice>Allowed options for select items could not be loaded; enter values as text.</Notice> : null}
        {!canReadTemplate && responses.some((r) => r.responseTypeSnapshot.endsWith("SELECT")) && <Notice>Select options could not be loaded for your account. Type select answers as text.</Notice>}

        {sections.map((s) => {
          const rows = s.rows.filter(({ r, i }) => matches(r, i));
          if (rows.length === 0) return null;
          const sDone = s.rows.filter(({ i }) => resultOf(i)).length;
          const open = !collapsed.has(s.key);
          return (
            <section key={s.key} aria-label={s.title} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setCollapsed((c) => { const n = new Set(c); if (open) n.add(s.key); else n.delete(s.key); return n; })}
                  className="flex min-w-0 cursor-pointer items-center gap-2 text-left"
                >
                  <CaretDownIcon aria-hidden className={cn("shrink-0 transition-transform", !open && "-rotate-90")} />
                  <span className="min-w-0">
                    <span className="font-heading text-base font-bold text-foreground">{s.title}</span>
                    <span className={cn("ml-2 text-xs tabular-nums", sDone === s.rows.length ? "text-success" : "text-muted-foreground")}>
                      {sDone}/{s.rows.length}
                    </span>
                    {s.note && <span className="block text-xs text-muted-foreground">{s.note}</span>}
                  </span>
                </button>
                {sDone < s.rows.length && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmAllPass(s.rows)}>
                    <ChecksIcon aria-hidden /> All Pass
                  </Button>
                )}
              </div>
              {open && (
                <ol className="space-y-2">
                  {rows.map(({ r, i }) => (
                    <EditableItem
                      key={r.inspectionResponseId}
                      r={r}
                      i={i}
                      options={optionsFor(r)}
                      form={form}
                      description={describe(s, r)}
                      numberError={form.formState.errors.items?.[i]?.number?.message}
                      inspection={inspection}
                      onAnswered={onAnswered}
                    />
                  ))}
                </ol>
              )}
            </section>
          );
        })}
        {sections.every((s) => s.rows.every(({ r, i }) => !matches(r, i))) && (
          <p className="py-6 text-center text-sm text-muted-foreground">{view === "todo" ? "All items answered. Continue to Photos." : "Nothing in this view."}</p>
        )}

        {notPersisted > 0 && (
          <Notice tone="danger" title="Some answers were not stored">
            {notPersisted} item{notPersisted === 1 ? "" : "s"} came back unchanged from the server. Your input is kept on this page.{" "}
            <button type="button" className="font-medium underline" onClick={() => void saveNow()}>
              Try again
            </button>
          </Notice>
        )}
        {error ? (
          <div className="space-y-2">
            <ApiErrorNotice error={error} />
            <Button type="button" variant="secondary" size="sm" onClick={() => void saveNow()}>
              Try saving again
            </Button>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmAllPass !== null}
        onOpenChange={(o) => !o && setConfirmAllPass(null)}
        title={`Mark ${confirmAllPass?.filter(({ i }) => !resultOf(i)).length ?? 0} items as Pass?`}
        description="Only items without an answer are changed. You can still change any of them afterwards."
        confirmLabel="Mark as Pass"
        tone="primary"
        onConfirm={() => {
          if (confirmAllPass) passRemaining(confirmAllPass);
          setConfirmAllPass(null);
        }}
      />
    </SectionCard>
  );
}

function ReadOnlyChecklist({ responses, sections, storedRequired, required }: { responses: InspectionResponseDto[]; sections: Section[]; storedRequired: number; required: number }) {
  const done = responses.filter((r) => r.itemResult).length;
  return (
    <SectionCard>
      <PanelTitle title="Checklist" description={`${responses.length} item${responses.length === 1 ? "" : "s"} · ${storedRequired}/${required} required items have a result.`} />
      <div className="mb-4 rounded-lg border border-border bg-surface-muted/50 p-3">
        <Progress label="Items with a result" done={done} total={responses.length} />
      </div>
      <div className="space-y-4">
        {sections.map((s) => (
          <section key={s.key} aria-label={s.title}>
            <h3 className="font-heading text-base font-bold text-foreground">{s.title}</h3>
            {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
            <ol className="mt-2 divide-y divide-border rounded-lg border border-border">
              {s.rows.map(({ r }) => (
                <li key={r.inspectionResponseId} className="grid gap-2 p-3 text-sm md:grid-cols-[1fr_12rem_8rem] md:items-start">
                  <ItemTitle r={r} description={describe(s, r)} />
                  <div>
                    <span className="text-xs text-muted-foreground md:hidden">Answer </span>
                    <p className="break-words">{answerText(r)}</p>
                    {r.inspectorNotes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{r.inspectorNotes}</p>}
                  </div>
                  <div className="md:text-right">
                    {r.itemResult ? <StatusBadge value={r.itemResult} /> : <span className="text-muted-foreground">—</span>}
                    {r.answeredAtUtc && <p className="mt-1 text-[11px] text-muted-foreground">{fmtUtc(r.answeredAtUtc)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </SectionCard>
  );
}
