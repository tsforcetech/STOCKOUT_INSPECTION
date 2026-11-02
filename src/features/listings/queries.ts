import { useQuery } from "@tanstack/react-query";
import { moderationService } from "@/services/moderation.service";
import type { ModerationQueueQuery } from "@/api/types/catalog-moderation";

export const listingKeys = {
  all: ["listings"] as const,
  queue: (query: ModerationQueueQuery) => ["listings", "moderation-queue", query] as const,
  queueAll: ["listings", "moderation-queue"] as const,
  detail: (listingId: string, versionId: string) => ["listings", listingId, "versions", versionId, "moderation"] as const,
  eligibility: (listingId: string, versionId: string) => ["listings", listingId, "versions", versionId, "eligibility"] as const,
  history: (listingId: string) => ["listings", listingId, "publication-history"] as const,
  /** Everything about one listing (all versions, eligibility, history). */
  listing: (listingId: string) => ["listings", listingId] as const,
};

export function useModerationQueueQuery(query: ModerationQueueQuery, enabled = true) {
  return useQuery({
    queryKey: listingKeys.queue(query),
    queryFn: ({ signal }) => moderationService.queue(query, signal),
    enabled,
    placeholderData: (prev) => prev,
  });
}
