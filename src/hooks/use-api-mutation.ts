import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/errors";

interface Options<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** Query keys to invalidate after a verified success. */
  invalidate?: QueryKey[] | ((data: TData, vars: TVars) => QueryKey[]);
  successMessage?: string | ((data: TData, vars: TVars) => string);
  /** Show a toast on error (default true). Forms that render errors inline pass false. */
  toastOnError?: boolean;
  onSuccess?: (data: TData, vars: TVars) => void;
}

/**
 * Wraps useMutation with the app's mutation rules: success feedback only after the API confirms,
 * cache invalidation, error toast, and no automatic retries for non-idempotent writes.
 */
export function useApiMutation<TData = unknown, TVars = void>({ mutationFn, invalidate, successMessage, toastOnError = true, onSuccess }: Options<TData, TVars>) {
  const queryClient = useQueryClient();
  return useMutation<TData, unknown, TVars>({
    mutationFn,
    retry: false,
    onSuccess: async (data, vars) => {
      const keys = typeof invalidate === "function" ? invalidate(data, vars) : (invalidate ?? []);
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (successMessage) toast.success(typeof successMessage === "function" ? successMessage(data, vars) : successMessage);
      onSuccess?.(data, vars);
    },
    onError: (error) => {
      if (toastOnError) toast.error(getErrorMessage(error));
    },
  });
}
