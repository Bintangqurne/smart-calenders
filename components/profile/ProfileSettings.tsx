"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, ExternalLink, UserCircle } from "lucide-react";
import { getMyProfile, setProfile, type Profile } from "@/lib/api";

export function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    bio: "",
    profilePublic: true,
  });

  useEffect(() => {
    void (async () => {
      try {
        const res = await getMyProfile();
        if (res.profile) {
          setProfileState(res.profile);
          setForm({
            username: res.profile.username,
            displayName: res.profile.displayName,
            bio: res.profile.bio,
            profilePublic: res.profile.profilePublic,
          });
        }
      } catch (err) {
        console.error("getMyProfile failed", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setError(null);
    if (!form.username.trim()) {
      setError("Username is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await setProfile({
        username: form.username.trim(),
        displayName: form.displayName.trim() || undefined,
        bio: form.bio.trim(),
        profilePublic: form.profilePublic,
      });
      setProfileState(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading profile…
      </div>
    );
  }

  const profileUrl =
    profile && typeof window !== "undefined"
      ? `${window.location.origin}/u/${profile.username}`
      : "";

  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-5">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <UserCircle className="h-4 w-4" />
          Public profile
        </h3>
        <p className="text-xs text-muted-foreground">
          Claim a username and showcase your achievements. Shareable on
          LinkedIn or in your resume.
        </p>
      </div>

      {profile && form.profilePublic && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <span>
            Your profile is live at{" "}
            <a
              href={profileUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              /u/{profile.username}
            </a>
          </span>
          <ExternalLink className="h-3 w-3" />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium">Username</label>
        <div className="flex items-center">
          <span className="rounded-l-md border border-r-0 border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">
            /u/
          </span>
          <input
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                username: e.target.value.toLowerCase(),
              }))
            }
            placeholder="your-handle"
            pattern="[a-z0-9_-]{3,30}"
            className="flex-1 rounded-r-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          3–30 chars. Lowercase, numbers, dash or underscore.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">
          Display name <span className="text-slate-400">(optional)</span>
        </label>
        <input
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          placeholder="How your name appears publicly"
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">
          Bio <span className="text-slate-400">(280 chars)</span>
        </label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          maxLength={280}
          rows={3}
          placeholder="Software engineer obsessed with productivity"
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={form.profilePublic}
          onChange={(e) =>
            setForm((f) => ({ ...f, profilePublic: e.target.checked }))
          }
          className="h-3.5 w-3.5"
        />
        Make my profile visible at <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-slate-800">/u/{form.username || "handle"}</code>
      </label>

      {error && (
        <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || saved}
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : saved ? (
          <Check className="h-3 w-3" />
        ) : null}
        {saved ? "Saved!" : saving ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
