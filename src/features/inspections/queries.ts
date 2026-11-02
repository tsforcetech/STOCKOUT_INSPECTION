import { useQuery } from "@tanstack/react-query";
import { inspectionsService } from "@/services/inspections.service";
import type { InspectionQueueQuery } from "@/api/types/catalog-moderation";

export const inspectionKeys = {
  all: ["inspections"] as const,
  queueAll: ["inspections", "queue"] as const,
  queue: (query: InspectionQueueQuery) => ["inspections", "queue", query] as const,
  detail: (inspectionId: string) => ["inspections", "detail", inspectionId] as const,
  template: (templateId: string) => ["inspections", "template", templateId] as const,
};

export function useInspectionQueueQuery(query: InspectionQueueQuery, enabled = true) {
  return useQuery({
    queryKey: inspectionKeys.queue(query),
    queryFn: ({ signal }) => inspectionsService.queue(query, signal),
    enabled,
    placeholderData: (prev) => prev,
  });
}
