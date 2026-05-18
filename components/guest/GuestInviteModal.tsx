"use client";

import { useState } from "react";
import { Copy, Check, X, UserPlus } from "lucide-react";
import {
  createGuestInvite,
  type GuestInviteCreated,
  type GuestScope,
} from "@/lib/api";

const PRESETS: { label: string; seconds: number }[] = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "24 hours", seconds: 60 * 60 * 24 },
  { label: "7 days", seconds: 60 * 60 * 24 * 7 },
  { label: "30 days", seconds: 60 * 60 * 24 * 30 },
];

interface Props {
  scope: GuestScope;
  scopeId: string;
  label: string;
  onClose: () => void;
}

export function GuestInviteModal({ scope, scopeId, label, onClose }: Props) {
  const [expiresIn, setExpiresIn] = useState(PRESETS[1].seconds);
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState<GuestInviteCreated | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullUrl =
    info && typeof window !== "undefined"
      ? `${window.location.origin}${info.url}`
      : "";

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      const data = await createGuestInvite({
        scope,
        scopeId,
        expiresInSeconds: expiresIn,
        password: password.trim() || undefined,
      });
      setInfo(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function copy() {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("clipboard failed", err);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-[min(500px,95vw)] overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <UserPlus className="h-4 w-4" />
            Invite guest
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="text-xs text-slate-500">
            {scope === "meeting" ? "Meeting" : "File"}:{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {label}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Generate a link your guest can use to{" "}
            {scope === "meeting"
              ? "join the meeting"
              : "preview the file"}{" "}
            without creating an account.
          </p>

          {info ? (
            <div className="space-y-3">
              <div className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Invite created. Expires {new Date(info.expiresAt).toLocaleString()}.
                {info.hasPassword && " Password protected."}
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={fullUrl}
                  className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setInfo(null)}
                className="text-xs text-slate-500 underline"
              >
                Create another invite
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  Expires in
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.seconds}
                      type="button"
                      onClick={() => setExpiresIn(p.seconds)}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        expiresIn === p.seconds
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">
                  Password (optional)
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank for no password"
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              {error && (
                <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create invite link"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
