import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Table/filter state persisted in the URL so it survives refresh, deep links and back-navigation
 * from detail screens.
 */
export function useUrlState<T extends Record<string, string | number | undefined>>(defaults: T) {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const result: Record<string, string | number | undefined> = { ...defaults };
    for (const [key, def] of Object.entries(defaults)) {
      const raw = params.get(key);
      if (raw === null) continue;
      result[key] = typeof def === "number" ? (Number.isFinite(Number(raw)) ? Number(raw) : def) : raw;
    }
    return result as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback(
    (patch: Partial<T>, options?: { resetPage?: boolean }) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const entries: Array<[string, unknown]> = Object.entries(patch);
          if (options?.resetPage && "page" in defaults && !("page" in patch)) entries.push(["page", undefined]);
          for (const [key, value] of entries) {
            if (value === undefined || value === null || value === "" || value === defaults[key]) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  return [state, update] as const;
}
