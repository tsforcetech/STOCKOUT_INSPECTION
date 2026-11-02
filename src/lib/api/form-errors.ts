import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { getErrorMessage, isApiError } from "./errors";

/**
 * Maps backend field errors onto react-hook-form fields. Returns the message to show at form level
 * (for errors not tied to a known field), or null when every error was attached to a field.
 */
export function applyApiErrorToForm<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, knownFields: ReadonlyArray<string>): string | null {
  if (!isApiError(error) || !error.hasFieldErrors) return getErrorMessage(error);
  const unmatched: string[] = [];
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const match = knownFields.find((f) => f.toLowerCase() === field.toLowerCase());
    if (match) setError(match as Path<T>, { type: "server", message: messages.join(" ") });
    else unmatched.push(...messages);
  }
  if (unmatched.length) return unmatched.join(" ");
  return null;
}
