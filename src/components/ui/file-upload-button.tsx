"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type State = { error?: string; ok?: boolean };

// Small reusable upload form: a file input + submit, posting to a server action
// (signature: (prev, formData) => FormState) along with fixed hidden fields.
export function FileUploadButton({
  action,
  hidden,
  label = "Upload",
  accept,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  hidden: Record<string, string>;
  label?: string;
  accept?: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        type="file"
        name="file"
        accept={accept}
        required
        className="max-w-[200px] text-xs file:mr-2 file:rounded file:border file:bg-muted file:px-2 file:py-1"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Uploading…" : label}
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
