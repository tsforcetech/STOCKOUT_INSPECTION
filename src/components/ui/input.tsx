import * as React from "react";
import { cn } from "@/lib/utils/cn";

import { inputClass } from "./input-class";

export { inputClass };
export { NativeSelect } from "./select";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputClass, "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(inputClass, "h-auto min-h-20 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";


export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm leading-[18px] text-body", className)} {...props} />;
}
