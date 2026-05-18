"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Inbox as InboxIcon } from "lucide-react";
import { useNotifications } from "@/contexts/notifications-context";
import type { Notification, NotificationType } from "@/lib/api";

const TYPE_LABELS: Record<NotificationType, string> = {
  mention: "Mentions",
  reply: "Replies",
  reaction: "Reactions",
  task_assigned: "Tasks",
  meeting_invite: "Meetings",
  file_share: "Files",
};

function fmtFull(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

function typeBadgeColor(t: NotificationType): string {
  switch (t) {
    case "mention":
      return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
    case "task_assigned":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    case "meeting_invite":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    case "file_share":
      return "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

export default function InboxPage() {
  const { notifications, unreadCount, markRead, markAllRead, reload, loading } =
    useNotifications();
  const [filter, setFilter] = useState<"all" | "unread" | NotificationType>(
    "all"
  );

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const typesPresent = useMemo(() => {
    const s = new Set<NotificationType>();
    notifications.forEach((n) => s.add(n.type));
    return [...s];
  }, [notifications]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <InboxIcon className="h-6 w-6" />
            Inbox
          </h1>
          <p className="text-sm text-slate-500">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You're all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        <FilterChip
          active={filter === "unread"}
          onClick={() => setFilter("unread")}
        >
          Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
        </FilterChip>
        {typesPresent.map((t) => (
          <FilterChip
            key={t}
            active={filter === t}
            onClick={() => setFilter(t)}
          >
            {TYPE_LABELS[t] ?? t}
          </FilterChip>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500 dark:border-slate-700">
            Nothing here.
          </div>
        ) : (
          filtered.map((n) => <NotificationItem key={n.sk} n={n} onClick={() => void markRead(n.sk)} />)
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function NotificationItem({
  n,
  onClick,
}: {
  n: Notification;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
        n.read
          ? "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          : "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30"
      }`}
    >
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${typeBadgeColor(n.type)}`}
          >
            {TYPE_LABELS[n.type] ?? n.type}
          </span>
          {!n.read && (
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
          )}
        </div>
        <div className="font-medium text-slate-800 dark:text-slate-100">
          {n.title}
        </div>
        <div className="mt-0.5 line-clamp-2 text-sm text-slate-500">
          {n.body}
        </div>
        <div className="mt-1 text-[10px] text-slate-400">
          {fmtFull(n.createdAt)}
        </div>
      </div>
    </button>
  );
}
