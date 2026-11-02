import { useQuery } from "@tanstack/react-query";
import { catalogService } from "@/services/catalog.service";
import { listingCorrectionsService } from "@/services/listing-corrections.service";
import type { AdminCorrectionsQuery } from "@/api/types/listing-corrections";

export const correctionKeys = {
  all: ["corrections"] as const,
  list: (query: AdminCorrectionsQuery) => ["corrections", "list", query] as const,
  detail: (correctionId: string) => ["corrections", "detail", correctionId] as const,
  audit: (correctionId: string) => ["corrections", "audit", correctionId] as const,
  snapshot: (inspectionId: string) => ["corrections", "snapshot", inspectionId] as const,
};

export function useCorrectionsQuery(query: AdminCorrectionsQuery, enabled = true) {
  return useQuery({
    queryKey: correctionKeys.list(query),
    queryFn: ({ signal }) => listingCorrectionsService.list(query, signal),
    enabled,
    placeholderData: (prev) => prev,
  });
}

/** Condition and grade names, so before/after ids read as names. */
export function useConditionGradeNames() {
  const conditions = useQuery({ queryKey: ["catalog", "conditions"], queryFn: ({ signal }) => catalogService.conditions(signal), staleTime: 10 * 60_000 });
  const grades = useQuery({ queryKey: ["catalog", "grades"], queryFn: ({ signal }) => catalogService.grades(signal), staleTime: 10 * 60_000 });
  const names = new Map<string, string>();
  for (const c of conditions.data ?? []) names.set(c.conditionId.toLowerCase(), c.name);
  for (const g of grades.data ?? []) names.set(g.gradeId.toLowerCase(), g.name);
  return names;
}
