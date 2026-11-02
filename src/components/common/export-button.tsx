import { UploadSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/** Figma "Export" header button. Exports exactly the rows currently loaded/filtered. */
export function ExportButton({ onExport, disabled }: { onExport: () => void; disabled?: boolean }) {
  return (
    <Button variant="secondary" size="lg" className="h-12 rounded-md px-4 text-base" onClick={onExport} disabled={disabled}>
      Export <UploadSimpleIcon className="size-5" />
    </Button>
  );
}
