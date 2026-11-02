import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InspectionDetailDto, RowVersion } from "@/api/types/catalog-moderation";
import { inspectionsService } from "@/services/inspections.service";
import { isConflict } from "@/features/listings/shared";
import { inspectionKeys } from "../queries";

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

interface Writer {
  /**
   * Runs one write with the current inspection rowVersion. Writes are serialised so autosave, photo uploads and
   * completion never race each other with a stale version. A version conflict reloads the inspection and the
   * write is retried once with the fresh version.
   */
  run: <T>(write: (rowVersion: RowVersion) => Promise<T>, nextVersion?: (result: T) => RowVersion | undefined) => Promise<T>;
  /** Checklist autosave state, shown in the header and used to hold back "Submit result" until answers are stored. */
  saveState: SaveState;
  setSaveState: (s: SaveState) => void;
  /** Resolves once every queued write has finished. */
  idle: () => Promise<void>;
}

const WriterContext = React.createContext<Writer | null>(null);

export function InspectionWriterProvider({ inspection, children }: { inspection: InspectionDetailDto; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const key = inspectionKeys.detail(inspection.inspectionId);
  const version = React.useRef<RowVersion | null>(inspection.rowVersion);
  const chain = React.useRef<Promise<unknown>>(Promise.resolve());
  const busy = React.useRef(0);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");

  // A refetch while nothing is queued is the freshest version we know.
  React.useEffect(() => {
    if (busy.current === 0) version.current = inspection.rowVersion;
  }, [inspection.rowVersion]);

  const fresh = React.useCallback(async () => {
    const d = await queryClient.fetchQuery({ queryKey: key, queryFn: ({ signal }) => inspectionsService.detail(inspection.inspectionId, signal), staleTime: 0 });
    version.current = d.rowVersion;
    return d.rowVersion;
  }, [queryClient, key, inspection.inspectionId]);

  const run = React.useCallback<Writer["run"]>(
    (write, nextVersion) => {
      busy.current++;
      const task = chain.current.catch(() => undefined).then(async () => {
        const once = async (rv: RowVersion) => {
          const result = await write(rv);
          const next = nextVersion?.(result);
          version.current = next ?? null;
          return result;
        };
        try {
          return await once(version.current ?? (await fresh()));
        } catch (e) {
          if (!isConflict(e)) throw e;
          return await once(await fresh());
        }
      });
      chain.current = task
        .then(
          () => undefined,
          () => undefined,
        )
        .finally(() => {
          busy.current--;
          void queryClient.invalidateQueries({ queryKey: key });
        });
      return task;
    },
    [fresh, queryClient, key],
  );

  const idle = React.useCallback(() => chain.current.then(() => undefined), []);
  const value = React.useMemo(() => ({ run, saveState, setSaveState, idle }), [run, saveState, idle]);
  return <WriterContext.Provider value={value}>{children}</WriterContext.Provider>;
}

export function useInspectionWriter(): Writer {
  const w = React.useContext(WriterContext);
  if (!w) throw new Error("useInspectionWriter needs <InspectionWriterProvider>");
  return w;
}

/** Optional variant for components that also render outside the detail page (tests, other screens). */
export function useOptionalInspectionWriter(): Writer | null {
  return React.useContext(WriterContext);
}
