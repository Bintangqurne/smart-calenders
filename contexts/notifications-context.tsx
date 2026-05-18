"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/api";
import { useRealtime } from "./realtime-context";

type NotificationsValue = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  reload: () => Promise<void>;
  markRead: (sk: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  reload: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { client } = useRealtime();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { notifications: list, unreadCount: count } =
        await listNotifications({ limit: 50 });
      setNotifications(list);
      setUnreadCount(count);
    } catch (err) {
      console.error("listNotifications failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!client) return;
    return client.on("notification.new", (msg: any) => {
      const n = msg.notification as Notification;
      setNotifications((prev) => {
        if (prev.some((p) => p.sk === n.sk)) return prev;
        return [n, ...prev].slice(0, 50);
      });
      if (n.read !== true) setUnreadCount((c) => c + 1);
    });
  }, [client]);

  const markRead = useCallback(async (sk: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.sk === sk ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(sk);
    } catch (err) {
      console.error("markRead failed", err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.error("markAllRead failed", err);
    }
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, loading, reload, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
