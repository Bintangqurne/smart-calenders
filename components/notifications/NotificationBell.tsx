"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useNotifications } from "@/contexts/notifications-context";
import type { Notification } from "@/lib/api";

function fmtRelative(iso: string): string {
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  } catch {
    return "";
  }
}

function notifIcon(n: Notification): string {
  switch (n.type) {
    case "mention":
      return "@";
    case "reply":
      return "↩";
    case "reaction":
      return "❤";
    case "task_assigned":
      return "✓";
    case "meeting_invite":
      return "📅";
    case "file_share":
      return "📎";
    default:
      return "•";
  }
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No notifications yet.
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <button
                  key={n.sk}
                  type="button"
                  onClick={() => void markRead(n.sk)}
                  className={`flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                    n.read ? "" : "bg-indigo-50/50 dark:bg-indigo-950/30"
                  }`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm dark:bg-slate-800">
                    {notifIcon(n)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {n.title}
                    </div>
                    <div className="line-clamp-2 text-slate-500">{n.body}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {fmtRelative(n.createdAt)}
                    </div>
                  </div>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                  )}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800">
            <Link
              href="/inbox"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-center text-xs font-medium text-indigo-600 hover:bg-slate-50 dark:text-indigo-400 dark:hover:bg-slate-800"
            >
              View all in Inbox
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
