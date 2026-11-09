import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CameraIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/misc";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { getErrorMessage } from "@/lib/api/errors";
import { FILE_LIMITS, filesService, isAllowedFileType } from "@/services/files.service";
import { platformService } from "@/services/platform.service";
import type { UpdateUserProfileRequest, UserProfileResponse } from "@/api/types/user-organization";
import { accountKeys } from "./queries";

const LIMIT = FILE_LIMITS.USER_PROFILE_PHOTO;

/**
 * Upload → PUT /users/me with the new profileImageAssetId. The PUT carries the saved profile fields
 * so nothing else changes. "Remove photo" sends profileImageAssetId:null (C6 / F2-K: Optional<Guid?>,
 * explicit null clears) and only reports success when the returned profile has no photo.
 */
export function ProfilePhoto({ profile, name, fallbackDisplayName, children }: { profile: UserProfileResponse | null; name: string; fallbackDisplayName: string; children?: React.ReactNode }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const assetId = profile?.profileImageAssetId ?? null;

  const photo = useQuery({
    queryKey: accountKeys.photo(assetId ?? ""),
    queryFn: () => filesService.downloadUrl(assetId ?? ""),
    enabled: Boolean(assetId),
    staleTime: 10 * 60_000, // presigned URLs last 15 minutes
    retry: false,
  });

  const upload = useApiMutation({
    mutationFn: async (file: File) => {
      const asset = await filesService.upload(file, "USER_PROFILE_PHOTO", { onProgress: setProgress });
      const displayName = profile?.displayName?.trim() || fallbackDisplayName.trim();
      const body: UpdateUserProfileRequest = {
        displayName,
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        preferredLocale: profile?.preferredLocale ?? null,
        timeZone: profile?.timeZone ?? null,
        profileImageAssetId: asset.fileId,
      };
      return platformService.updateMyProfile(body);
    },
    invalidate: [accountKeys.profile],
    toastOnError: false,
    successMessage: "Profile photo updated.",
    onSuccess: () => setProgress(null),
  });

  const remove = useApiMutation({
    mutationFn: async () => {
      const displayName = profile?.displayName?.trim() || fallbackDisplayName.trim();
      const updated = await platformService.updateMyProfile({
        displayName,
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        preferredLocale: profile?.preferredLocale ?? null,
        timeZone: profile?.timeZone ?? null,
        profileImageAssetId: null,
      });
      if (updated?.profileImageAssetId) throw new Error("The server kept the old photo. Removing photos isn't working yet — please try again later.");
      return updated;
    },
    invalidate: [accountKeys.profile],
    toastOnError: false,
    successMessage: "Profile photo removed.",
  });

  const onFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!isAllowedFileType(file, "USER_PROFILE_PHOTO")) return setError("Use a JPEG, PNG or WebP image (.jpg, .jpeg, .png or .webp).");
    if (file.size > LIMIT.maxBytes) return setError(`The image must be ${Math.round(LIMIT.maxBytes / 1024 / 1024)} MB or smaller.`);
    if (!(profile?.displayName?.trim() || fallbackDisplayName.trim())) return setError("Save a display name before uploading a photo.");
    upload.mutate(file, {
      onError: (e) => {
        setProgress(null);
        setError(getErrorMessage(e));
      },
    });
  };

  const busy = upload.isPending || remove.isPending;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <Avatar name={name} src={photo.data?.downloadUrl} className="size-24 bg-surface shadow-sm ring-1 ring-border ring-offset-4 ring-offset-surface" fallbackClassName="text-3xl font-bold ring-0" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={assetId ? "Change photo" : "Upload photo"}
          title={assetId ? "Change photo" : "Upload photo"}
          className="absolute -bottom-0.5 -right-0.5 flex size-9 items-center justify-center rounded-full border-2 border-surface bg-foreground text-surface shadow-md transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          {upload.isPending ? <SpinnerGapIcon className="size-4 animate-spin" aria-hidden /> : <CameraIcon className="size-4" weight="bold" aria-hidden />}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={LIMIT.accept}
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload profile photo"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {children && <div className="mt-4 w-full min-w-0">{children}</div>}
      <div className="mt-3 flex items-center gap-3 text-xs">
        <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-60" disabled={busy} onClick={() => inputRef.current?.click()}>
          {assetId ? "Change photo" : "Add a photo"}
        </button>
        {assetId && (
          <>
            <span className="text-border" aria-hidden>
              |
            </span>
            <button
              type="button"
              className="font-medium text-muted-foreground underline-offset-4 hover:text-danger-soft-foreground hover:underline disabled:opacity-60"
              disabled={busy}
              onClick={() => {
                setError(null);
                remove.mutate(undefined, { onError: (e) => setError(getErrorMessage(e)) });
              }}
            >
              {remove.isPending ? "Removing…" : "Remove"}
            </button>
          </>
        )}
      </div>
      {progress !== null && upload.isPending && (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          Uploading… {Math.round(progress * 100)}%
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger-soft-foreground">
          {error}
        </p>
      )}
      {photo.error && <p className="mt-2 text-xs text-muted-foreground">The current photo couldn't be loaded.</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">JPEG, PNG or WebP · up to 5 MB</p>
    </div>
  );
}
