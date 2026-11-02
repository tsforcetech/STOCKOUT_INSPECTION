import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CameraIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
export function ProfilePhoto({ profile, name, fallbackDisplayName }: { profile: UserProfileResponse | null; name: string; fallbackDisplayName: string }) {
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

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Avatar name={name} src={photo.data?.downloadUrl} className="size-24 text-2xl" />
      <input
        ref={inputRef}
        type="file"
        accept={LIMIT.accept}
        className="sr-only"
        aria-label="Upload profile photo"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
        <CameraIcon /> {assetId ? "Change photo" : "Upload photo"}
      </Button>
      {assetId && (
        <Button
          variant="ghost"
          size="sm"
          loading={remove.isPending}
          disabled={upload.isPending}
          onClick={() => {
            setError(null);
            remove.mutate(undefined, { onError: (e) => setError(getErrorMessage(e)) });
          }}
        >
          Remove photo
        </Button>
      )}
      {progress !== null && upload.isPending && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Uploading… {Math.round(progress * 100)}%
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger-soft-foreground">
          {error}
        </p>
      )}
      {photo.error && <p className="text-xs text-muted-foreground">The current photo couldn't be loaded.</p>}
      <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 5 MB.</p>
    </div>
  );
}
