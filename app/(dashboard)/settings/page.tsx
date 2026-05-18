"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, Unplug, Info, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getGoogleStatus, disconnectGoogle, type GoogleStatus } from "@/lib/api";
import { ProfileSettings } from "@/components/profile/ProfileSettings";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "1012900320741-thgtlgjq2u0u16ve84run8vvt4rcnl2d.apps.googleusercontent.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
const REDIRECT_URI = `${APP_URL}/api/auth/callback`;
const SCOPE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.events.freebusy",
].join(" ");

const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
  REDIRECT_URI
)}&response_type=code&scope=${encodeURIComponent(SCOPE)}&access_type=offline&prompt=consent`;

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

export default function SettingsPage() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      const res = await getGoogleStatus();
      setStatus(res);
    } catch (err) {
      setError("Failed to load Google connection status.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Are you sure you want to disconnect from Google Calendar? You will have to log in again to reconnect.")) return;
    setDisconnecting(true);
    try {
      await disconnectGoogle();
      await loadStatus();
    } catch (err) {
      setError("Failed to disconnect Google Calendar.");
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading settings...
      </div>
    );
  }

  const hasFullScopes = status?.scopes?.includes("https://www.googleapis.com/auth/calendar.events.freebusy") ||
                        status?.scopes?.includes("https://www.googleapis.com/auth/calendar.readonly") ||
                        status?.scopes?.includes("https://www.googleapis.com/auth/calendar");

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-3xl space-y-6">
      <motion.div variants={item} className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Settings2 className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your integrations and personal settings.</p>
        </div>
      </motion.div>

      {error ? (
        <motion.div variants={item} className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </motion.div>
      ) : null}

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Google Calendar Integration</CardTitle>
            <CardDescription>
              Connect your Google Calendar to let colleagues see when you are busy, and automatically schedule meetings into your calendar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
                  <svg className="size-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <div>
                  {status?.connected ? (
                    <>
                      <h3 className="font-semibold text-sm">Connected as {status.email}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="size-3.5" />
                        Sync Active
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="font-semibold text-sm">Not Connected</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">App will only use internal events for your schedule.</p>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                {status?.connected ? (
                  <Button variant="outline" className="text-destructive hover:bg-destructive/10" disabled={disconnecting} onClick={handleDisconnect}>
                    {disconnecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Unplug className="mr-2 size-4" />}
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={() => window.location.href = googleAuthUrl}>
                    Connect Google
                  </Button>
                )}
              </div>
            </div>

            {status?.connected && (
              <div className="rounded-lg bg-muted/40 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="size-4 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">How it works</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Smart Scheduler reads your Google Calendar "Free/Busy" status so your team knows when not to schedule meetings with you. 
                      When a meeting is scheduled via the app, it is automatically pushed to your Google Calendar.
                    </p>
                  </div>
                </div>

                {!hasFullScopes && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 mt-4 border border-amber-500/20">
                    <AlertCircle className="size-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Limited Permissions</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Your account is missing some Free/Busy calendar read permissions. To fix this, you need to reconnect and grant all requested permissions.
                      </p>
                      <Button variant="outline" size="sm" className="mt-3 h-8 text-xs border-amber-500/30 text-amber-700 hover:bg-amber-500/20" onClick={() => window.location.href = googleAuthUrl}>
                        Reconnect Account
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <ProfileSettings />
      </motion.div>
    </motion.div>
  );
}
