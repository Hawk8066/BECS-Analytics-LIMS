"use client";

import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Error boundary for the whole staff app.
 *
 * Without this, anything that throws in a page — or worse, in the layout — renders
 * Next's bare 500 with no way back. The most likely cause in practice is a schema
 * the running code does not match: a migration not yet applied, or applied while
 * the old build was still serving. That is exactly when a readable message and a
 * retry button are worth having.
 *
 * Deliberately says nothing about the underlying error: the message can carry
 * table and column names, and this page is reachable by every signed-in user,
 * including blinded analysts. The detail goes to the server log instead.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          This page could not be loaded. The problem has been logged. Trying again
          often works — if it does not, the issue is on our side, not yours.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          {/* A plain anchor, not next/link: a full navigation re-runs the server
              render from scratch, which is what recovers a broken layout. */}
          <a href="/app" className={buttonVariants({ variant: "outline" })}>
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
