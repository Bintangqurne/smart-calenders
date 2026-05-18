"use client";

import { use, useEffect, useState } from "react";
import { Loader2, UserX, Trophy, CheckCircle2, Calendar } from "lucide-react";
import { getPublicProfile, type PublicProfile } from "@/lib/api";

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getPublicProfile(username);
        setProfile(data);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center dark:bg-slate-950">
        <UserX className="h-10 w-10 text-slate-400" />
        <h1 className="text-xl font-semibold">Profile unavailable</h1>
        <p className="text-sm text-slate-500">
          {error ?? "This profile does not exist or is private."}
        </p>
        <a
          href="/login"
          className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Sign up free
        </a>
      </div>
    );
  }

  const initials = (profile.displayName ?? profile.username)
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 dark:from-indigo-950 dark:via-slate-950 dark:to-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-500" />
          <div className="-mt-12 px-6 pb-6">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-indigo-600 text-2xl font-bold text-white dark:border-slate-900">
              {initials || "👤"}
            </div>
            <h1 className="text-2xl font-bold">{profile.displayName}</h1>
            <p className="text-sm text-slate-500">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                {profile.bio}
              </p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              Member since{" "}
              {new Date(profile.memberSince).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <StatCard
            icon={<Trophy className="h-5 w-5 text-amber-500" />}
            label="Points"
            value={profile.stats.points.toLocaleString()}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            label="Tasks done"
            value={profile.stats.completedTasks.toLocaleString()}
          />
        </div>

        {profile.badges.length > 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Achievements
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {profile.badges.map((b) => (
                <div
                  key={b.name}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800"
                  title={b.description}
                >
                  <div className="text-3xl">{b.icon}</div>
                  <div className="mt-1 text-xs font-semibold">{b.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {b.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-center text-sm dark:border-indigo-900 dark:bg-indigo-950">
          <p className="mb-2 font-semibold">Build your own profile</p>
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
            Track tasks, run meetings with your team, and earn badges.
          </p>
          <a
            href="/login"
            className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Sign up free
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
