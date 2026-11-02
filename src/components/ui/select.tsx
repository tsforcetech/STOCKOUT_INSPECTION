import * as React from "react";
import { Popover, Select as S } from "radix-ui";
import { CaretDownIcon, CheckIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";
import { inputClass } from "./input-class";

interface Option {
  value: string;
  label: React.ReactNode;
  text: string;
  disabled: boolean;
}

/** Radix item values can't be empty strings; "" (e.g. "All categories") is mapped to this sentinel. */
const EMPTY = "__so_empty__";
const VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!;

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function collectOptions(children: React.ReactNode, out: Option[] = []): Option[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode; value?: unknown; disabled?: boolean }>(child)) return;
    if (child.type === React.Fragment) {
      collectOptions(child.props.children, out);
      return;
    }
    if (child.type === "option") {
      const text = textOf(child.props.children);
      out.push({ value: child.props.value != null ? String(child.props.value) : text, label: child.props.children, text, disabled: !!child.props.disabled });
    }
  });
  return out;
}

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  placeholder?: string;
  /** Show a search box in the dropdown. Defaults to on for lists longer than SEARCH_THRESHOLD options. */
  searchable?: boolean;
  searchPlaceholder?: string;
};

/** Lists longer than this get a search box (sellers, categories, users… grow without limit). */
const SEARCH_THRESHOLD = 10;
const norm = (v: string) => v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Drop-in replacement for a native <select> with a styled dropdown (Radix Select).
 * Takes the same props and <option> children. A hidden native <select> keeps the real value, so react-hook-form's
 * register(), form submission, `required` and onChange(e.target.value) all behave exactly as before.
 */
export const NativeSelect = React.forwardRef<HTMLSelectElement, Props>(function NativeSelect(
  {
    className,
    children,
    value,
    defaultValue,
    onChange,
    onBlur,
    disabled,
    id,
    placeholder,
    searchable,
    searchPlaceholder,
    title,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...rest
  },
  ref,
) {
  const options = collectOptions(children);
  const selectRef = React.useRef<HTMLSelectElement | null>(null);
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState<string>(defaultValue != null ? String(defaultValue) : (options[0]?.value ?? ""));
  const current = controlled ? String(value) : inner;
  const setInnerRef = React.useRef(setInner);
  const selected = options.find((o) => o.value === current);

  const setRefs = React.useCallback(
    (el: HTMLSelectElement | null) => {
      selectRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
      if (el && !controlled) {
        // react-hook-form (register/reset/setValue) writes `select.value` directly; mirror those writes through a
        // per-element prototype (jsdom's select proxy rejects own accessors, browsers accept either).
        if (!(el as { __soPatched?: boolean }).__soPatched) {
          const proto = Object.create(Object.getPrototypeOf(el), {
            value: {
              configurable: true,
              get() {
                return VALUE.get!.call(this);
              },
              set(v: string) {
                VALUE.set!.call(this, v);
                setInnerRef.current(VALUE.get!.call(this) as string);
              },
            },
            __soPatched: { value: true },
          });
          Object.setPrototypeOf(el, proto);
        }
        setInner(el.value);
      }
    },
    [ref, controlled],
  );

  const choose = (v: string) => {
    const next = v === EMPTY ? "" : v;
    const el = selectRef.current;
    if (el) {
      VALUE.set!.call(el, next);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (!controlled) setInner(next);
  };

  const hidden = (
    <select
      {...rest}
      ref={setRefs}
      {...(controlled ? { value } : { defaultValue })}
      onChange={onChange ?? (() => undefined)}
      onBlur={onBlur}
      disabled={disabled}
      aria-hidden
      tabIndex={-1}
      className="sr-only"
    >
      {children}
    </select>
  );

  if (searchable ?? options.length > SEARCH_THRESHOLD) {
    return (
      <>
        {hidden}
        <SearchableDropdown
          options={options}
          current={current}
          selected={selected}
          onChoose={choose}
          onClosed={() => selectRef.current?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))}
          disabled={disabled}
          id={id}
          title={title}
          ariaLabel={ariaLabel}
          ariaLabelledBy={ariaLabelledBy}
          ariaDescribedBy={ariaDescribedBy}
          ariaInvalid={ariaInvalid}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          className={className}
        />
      </>
    );
  }

  return (
    <>
      <select
        {...rest}
        ref={setRefs}
        {...(controlled ? { value } : { defaultValue })}
        onChange={onChange ?? (() => undefined)}
        onBlur={onBlur}
        disabled={disabled}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      >
        {children}
      </select>
      <S.Root
        value={current === "" ? EMPTY : current}
        onValueChange={choose}
        disabled={disabled}
        onOpenChange={(open) => {
          if (!open) selectRef.current?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
        }}
      >
        <S.Trigger
          id={id}
          title={title}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          className={cn(inputClass, "group/select cursor-pointer items-center justify-between gap-2 py-0 text-left data-[placeholder]:text-muted-foreground data-[state=open]:border-action-border", className)}
        >
          <span className={cn("min-w-0 truncate", !selected?.text && "text-muted-foreground")}>{selected ? selected.label : (placeholder ?? "Select…")}</span>
          <S.Icon asChild>
            <CaretDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/select:rotate-180" aria-hidden />
          </S.Icon>
        </S.Trigger>
        <S.Portal>
          <S.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            className="z-[80] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[max(var(--radix-select-trigger-width),10rem)] overflow-hidden rounded-xl border border-border bg-surface p-1 text-foreground shadow-raised data-[state=open]:animate-[fade-in_120ms_ease-out]"
          >
            <S.Viewport>
              {options.map((o) => (
                <S.Item
                  key={o.value || EMPTY}
                  value={o.value === "" ? EMPTY : o.value}
                  disabled={o.disabled}
                  textValue={o.text}
                  className="relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-surface-muted data-[state=checked]:font-medium"
                >
                  <S.ItemIndicator className="absolute left-2.5 inline-flex">
                    <CheckIcon className="size-4" weight="bold" />
                  </S.ItemIndicator>
                  <S.ItemText>{o.label}</S.ItemText>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </>
  );
});

/** Popover + search box + listbox, for long lists. Same trigger look as the Radix select. */
function SearchableDropdown({
  options,
  current,
  selected,
  onChoose,
  onClosed,
  disabled,
  id,
  title,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaInvalid,
  placeholder,
  searchPlaceholder,
  className,
}: {
  options: Option[];
  current: string;
  selected: Option | undefined;
  onChoose: (v: string) => void;
  onClosed: () => void;
  disabled?: boolean;
  id?: string;
  title?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: React.AriaAttributes["aria-invalid"];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const listId = React.useId();

  const q = norm(query.trim());
  const shown = q ? options.filter((o) => norm(o.text).includes(q) || norm(o.value) === q) : options;

  const setOpenState = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    } else onClosed();
  };

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  const pick = (o: Option | undefined) => {
    if (!o || o.disabled) return;
    onChoose(o.value === "" ? EMPTY : o.value);
    setOpenState(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = (dir: 1 | -1) => {
      if (!shown.length) return;
      let i = active;
      for (let n = 0; n < shown.length; n++) {
        i = (i + dir + shown.length) % shown.length;
        if (!shown[i]!.disabled) break;
      }
      setActive(i);
    };
    const keys: Record<string, () => void> = {
      ArrowDown: () => step(1),
      ArrowUp: () => step(-1),
      Home: () => setActive(0),
      End: () => setActive(Math.max(0, shown.length - 1)),
      Enter: () => pick(shown[active]),
    };
    const run = keys[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpenState}>
      <Popover.Trigger
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        data-state={open ? "open" : "closed"}
        className={cn(inputClass, "group/select cursor-pointer items-center justify-between gap-2 py-0 text-left disabled:cursor-not-allowed data-[state=open]:border-action-border", className)}
      >
        <span className={cn("min-w-0 truncate", !selected?.text && "text-muted-foreground")}>{selected ? selected.label : (placeholder ?? "Select…")}</span>
        <CaretDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/select:rotate-180" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.querySelector("input")?.focus();
          }}
          className="z-[80] flex max-h-[min(380px,var(--radix-popover-content-available-height))] w-[max(var(--radix-popover-trigger-width),16rem)] max-w-[min(26rem,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-raised data-[state=open]:animate-[fade-in_120ms_ease-out]"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder ?? "Search…"}
              aria-label={searchPlaceholder ?? "Search options"}
              aria-controls={listId}
              aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel ?? "Options"} className="min-h-0 flex-1 overflow-y-auto p-1">
            {shown.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches for “{query.trim()}”</li>
            ) : (
              shown.map((o, i) => (
                <li
                  key={o.value || EMPTY}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={o.value === current}
                  aria-disabled={o.disabled || undefined}
                  onMouseMove={() => !o.disabled && setActive(i)}
                  onClick={() => pick(o)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm",
                    i === active && "bg-surface-muted",
                    o.value === current && "font-medium",
                    o.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  {o.value === current && <CheckIcon className="absolute left-2.5 size-4" weight="bold" aria-hidden />}
                  <span className="min-w-0 truncate">{o.label}</span>
                </li>
              ))
            )}
          </ul>
          {q && shown.length > 0 && (
            <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              {shown.length} of {options.length}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
