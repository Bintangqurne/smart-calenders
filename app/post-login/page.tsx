"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getGoogleStatus, type GoogleStatus } from "@/lib/api";

const FREE_BUSY_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.freebusy",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar",
];

function hasCalendarCoverage(status: GoogleStatus | null) {
  if (!status?.connected) return false;
  return status.scopes.some((scope) => FREE_BUSY_SCOPES.includes(scope));
}

export default function PostLoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyGoogleConnection() {
      try {
        const nextStatus = await getGoogleStatus();
        if (cancelled) return;

        setStatus(nextStatus);

        if (hasCalendarCoverage(nextStatus)) {
          router.replace("/");
          return;
        }

        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to verify Google connection:", err);
        setError("Failed to verify Google Calendar connection.");
        setLoading(false);
      }
    }

    void verifyGoogleConnection();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const isConnected = useMemo(() => hasCalendarCoverage(status), [status]);

  if (loading && isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Finalizing your workspace…
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Checking Google Calendar connection…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            {error ? <AlertCircle className="size-5" /> : <CheckCircle2 className="size-5" />}
          </div>
          <CardTitle className="text-xl">
            {error ? "Connection check failed" : "Finish Google Calendar setup"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error
              ? error
              : "Login succeeded, but this account is not fully connected for Free/Busy availability yet. Without that connection, meeting suggestions will fall back to internal events only."}
          </p>

          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium">Current status</p>
            <p className="mt-1 text-muted-foreground">
              {status?.connected
                ? `Signed in as ${status.email}, but calendar availability permission is still incomplete.`
                : "No Google Calendar refresh token was saved for this session yet."}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => router.replace("/settings")}>
              Open settings
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => router.replace("/")}>
              Continue anyway
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
