"use client";

import { use, useEffect, useState } from "react";
import {
  Lock,
  Loader2,
  CalendarDays,
  Video,
  FileText,
  Download,
} from "lucide-react";

interface ResolveResp {
  requiresPassword: boolean;
  scope?: "meeting" | "file";
  label?: string;
  meetingId?: string;
  room?: string;
  startTime?: string;
  endTime?: string;
  fileName?: string;
  previewUrl?: string;
  expiresIn?: number;
  error?: string;
}

async function resolveInvite(
  shortCode: string,
  password?: string
): Promise<ResolveResp> {
  const res = await fetch(`/api/proxy-public/public/guest/${shortCode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(password ? { password } : {}),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return { requiresPassword: false, error: err.error ?? `HTTP ${res.status}` };
  }
  return (await res.json()) as ResolveResp;
}

const JITSI_DOMAIN = "meet.jit.si";

function buildJitsiUrl(room: string, displayName: string): string {
  const cfg: Record<string, string | boolean> = {
    "config.prejoinPageEnabled": false,
    "config.startWithAudioMuted": true,
    "config.disableDeepLinking": true,
    "interfaceConfig.SHOW_JITSI_WATERMARK": false,
    "interfaceConfig.MOBILE_APP_PROMO": false,
  };
  const params = Object.entries(cfg)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const userInfo = `userInfo.displayName=${encodeURIComponent(`"${displayName}"`)}`;
  return `https://${JITSI_DOMAIN}/${encodeURIComponent(room)}#${params}&${userInfo}`;
}

function fmtRange(s?: string, e?: string): string {
  if (!s || !e) return "";
  try {
    const start = new Date(s);
    const end = new Date(e);
    return `${start.toLocaleString()} – ${end.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "";
  }
}

function isImage(m?: string) {
  return !!m && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(m);
}
function isVideo(m?: string) {
  return !!m && /\.(mp4|webm|mov|m4v)$/i.test(m);
}
function isPdf(m?: string) {
  return !!m && /\.pdf$/i.test(m);
}

export default function GuestPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = use(params);
  const [resp, setResp] = useState<ResolveResp | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const data = await resolveInvite(shortCode);
      setResp(data);
      setLoading(false);
    })();
  }, [shortCode]);

  async function unlock() {
    if (!password) return;
    setSubmitting(true);
    const data = await resolveInvite(shortCode, password);
    setResp(data);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!resp || resp.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center dark:bg-slate-950">
        <CalendarDays className="h-10 w-10 text-slate-400" />
        <h1 className="text-xl font-semibold">Invite unavailable</h1>
        <p className="text-sm text-slate-500">
          {resp?.error ??
            "This invite has expired, been revoked, or never existed."}
        </p>
      </div>
    );
  }

  if (resp.requiresPassword && !resp.room && !resp.previewUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-slate-900">
          <Lock className="mb-3 h-8 w-8 text-indigo-500" />
          <h1 className="text-lg font-semibold">Password required</h1>
          <p className="mb-4 text-sm text-slate-500">
            {resp.scope === "meeting" ? "Meeting" : "File"}{" "}
            <span className="font-medium">{resp.label}</span> is protected.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void unlock()}
            placeholder="Enter password"
            autoFocus
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={() => void unlock()}
            disabled={!password || submitting}
            className="mt-3 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Checking…" : "Unlock"}
          </button>
        </div>
      </div>
    );
  }

  if (resp.scope === "meeting" && resp.room) {
    if (joined) {
      return (
        <div className="flex min-h-screen flex-col bg-black">
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-white">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{resp.label}</div>
              <div className="text-[10px] text-slate-400">
                Guest: {guestName}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setJoined(false)}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium hover:bg-rose-700"
            >
              Leave
            </button>
          </header>
          <iframe
            src={buildJitsiUrl(resp.room, guestName || "Guest")}
            title={`Guest: ${resp.label}`}
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            className="flex-1 border-0"
          />
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-slate-900">
          <Video className="mb-3 h-8 w-8 text-emerald-500" />
          <h1 className="text-lg font-semibold">{resp.label}</h1>
          {fmtRange(resp.startTime, resp.endTime) && (
            <p className="mb-3 text-xs text-slate-500">
              {fmtRange(resp.startTime, resp.endTime)}
            </p>
          )}
          <p className="mb-4 text-sm text-slate-500">
            Join as a guest. Enter the name you want to be shown to attendees.
          </p>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={() => setJoined(true)}
            disabled={!guestName.trim()}
            className="mt-3 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Join meeting
          </button>
          <div className="mt-4 border-t border-slate-200 pt-3 text-center text-xs text-slate-500 dark:border-slate-800">
            Want your own team workspace?{" "}
            <a href="/login" className="text-indigo-600 hover:underline">
              Sign up free
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (resp.scope === "file" && resp.previewUrl) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-950">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{resp.label}</div>
            <div className="text-xs text-slate-400">Shared via Smart Scheduler</div>
          </div>
          <a
            href={resp.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium hover:bg-indigo-700"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </header>
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          {isImage(resp.label) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resp.previewUrl}
              alt={resp.label}
              className="max-h-full max-w-full object-contain"
            />
          ) : isVideo(resp.label) ? (
            <video
              src={resp.previewUrl}
              controls
              className="max-h-full max-w-full"
            />
          ) : isPdf(resp.label) ? (
            <iframe
              src={resp.previewUrl}
              title={resp.label}
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <div className="rounded-lg bg-slate-900 p-8 text-center text-slate-300">
              <FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" />
              <p className="text-sm">Click Download to view this file.</p>
            </div>
          )}
        </div>
        <div className="border-t border-slate-800 bg-slate-900 px-4 py-2 text-center text-xs text-slate-500">
          Want your own workspace?{" "}
          <a href="/login" className="text-indigo-400 hover:underline">
            Sign up free
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Unable to load invite.
    </div>
  );
}
