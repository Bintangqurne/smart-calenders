"use client";

import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertCircle className="size-6" />
          </div>
          <h1 className="text-2xl font-bold">Application error</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error stopped the app. Retry the last render or reload the workspace.
          </p>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium"
            >
              Reload app
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
