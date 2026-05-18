"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  X,
  Send,
  Smile,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import {
  deleteMessage,
  editMessage,
  listConversations,
  listMessages,
  markConversationRead,
  reactToMessage,
  sendMessage,
  type Conversation,
  type Message,
} from "@/lib/api";
import { ulid } from "@/lib/ulid";
import { useRealtime } from "@/contexts/realtime-context";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🚀", "✅"];

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function previewLabel(c: Conversation): string {
  if (c.type === "dm") return "Direct message";
  if (c.type === "channel") return (c as any).name ?? "Channel";
  if (c.type === "task_thread") return "Task thread";
  if (c.type === "meeting_thread") return "Meeting thread";
  if (c.type === "file_thread") return "File thread";
  return c.type;
}

function readMyUserId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)user_id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function ChatDock() {
  const { client, connected } = useRealtime();
  const myUserId = useMemo(() => readMyUserId(), []);
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [reactingFor, setReactingFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + (c.unreadCount ?? 0), 0),
    [conversations]
  );

  const reloadConversations = useCallback(async () => {
    try {
      const { conversations: list } = await listConversations();
      setConversations(list);
      return list;
    } catch (err) {
      console.error("listConversations failed", err);
      return [];
    }
  }, []);

  useEffect(() => {
    void reloadConversations();
  }, [reloadConversations]);

  useEffect(() => {
    if (!open) return;
    void reloadConversations().then((list) => {
      if (list.length > 0 && !activeId) setActiveId(list[0].conversationId);
    });
  }, [open, activeId, reloadConversations]);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    void (async () => {
      try {
        const { messages: list } = await listMessages(activeId, { limit: 50 });
        setMessages(list);
      } catch (err) {
        console.error("listMessages failed", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeId]);

  // Subscribe to all known conversations for unread updates.
  useEffect(() => {
    if (!client) return;
    const ids = conversations.map((c) => c.conversationId);
    ids.forEach((id) => client.subscribe(id));
    return () => {
      ids.forEach((id) => client.unsubscribe(id));
    };
  }, [client, conversations]);

  // Handle realtime events.
  useEffect(() => {
    if (!client) return;
    const offNew = client.on("message.new", (msg: any) => {
      const conversationId = msg.conversationId as string;
      const incoming = msg.message as Message;
      if (conversationId === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m.messageId === incoming.messageId)) return prev;
          return [...prev, incoming];
        });
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.conversationId === conversationId
            ? {
                ...c,
                lastMessageAt: incoming.createdAt,
                lastMessagePreview: incoming.body.slice(0, 140),
                unreadCount:
                  conversationId === activeId && open
                    ? 0
                    : (c.unreadCount ?? 0) +
                      (incoming.senderId === myUserId ? 0 : 1),
              }
            : c
        )
      );
    });
    const offReact = client.on("message.reaction", (msg: any) => {
      if (msg.conversationId !== activeId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === msg.messageId ? { ...m, reactions: msg.reactions } : m
        )
      );
    });
    const offEdit = client.on("message.edit", (msg: any) => {
      if (msg.conversationId !== activeId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === msg.messageId
            ? { ...m, body: msg.body, editedAt: msg.editedAt }
            : m
        )
      );
    });
    const offDelete = client.on("message.delete", (msg: any) => {
      if (msg.conversationId !== activeId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === msg.messageId
            ? { ...m, deletedAt: msg.deletedAt, body: "" }
            : m
        )
      );
    });
    return () => {
      offNew();
      offReact();
      offEdit();
      offDelete();
    };
  }, [client, activeId, open, myUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Auto mark-read when chat is open and messages arrive.
  useEffect(() => {
    if (!open || !activeId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    void markConversationRead(activeId, last.messageId).catch(() => {});
    setConversations((prev) =>
      prev.map((c) =>
        c.conversationId === activeId ? { ...c, unreadCount: 0 } : c
      )
    );
  }, [open, activeId, messages]);

  async function handleSend() {
    if (!activeId || !input.trim() || sending) return;
    const clientMsgId = ulid();
    const body = input.trim();
    setSending(true);
    setInput("");
    try {
      const sent = await sendMessage(activeId, { body, clientMsgId });
      setMessages((prev) => {
        if (prev.some((m) => m.messageId === sent.messageId)) return prev;
        return [...prev, sent];
      });
    } catch (err) {
      console.error("sendMessage failed", err);
      setInput(body);
    } finally {
      setSending(false);
    }
  }

  async function handleReact(messageId: string, emoji: string) {
    if (!activeId || !myUserId) return;
    const msg = messages.find((m) => m.messageId === messageId);
    const has = msg?.reactions?.[emoji]?.includes(myUserId) ?? false;
    setReactingFor(null);
    try {
      const { reactions } = await reactToMessage(
        activeId,
        messageId,
        emoji,
        has ? "remove" : "add"
      );
      setMessages((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, reactions } : m))
      );
    } catch (err) {
      console.error("react failed", err);
    }
  }

  async function handleSaveEdit() {
    if (!activeId || !editingId) return;
    const body = editingText.trim();
    if (!body) return;
    try {
      await editMessage(activeId, editingId, body);
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === editingId
            ? { ...m, body, editedAt: new Date().toISOString() }
            : m
        )
      );
      setEditingId(null);
      setEditingText("");
    } catch (err) {
      console.error("edit failed", err);
    }
  }

  async function handleDelete(messageId: string) {
    if (!activeId) return;
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteMessage(activeId, messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === messageId
            ? { ...m, deletedAt: new Date().toISOString(), body: "" }
            : m
        )
      );
    } catch (err) {
      console.error("delete failed", err);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700"
        aria-label="Toggle chat"
      >
        <MessageCircle className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[420px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Chat</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-emerald-500" : "bg-slate-400"
                }`}
                title={connected ? "Connected" : "Disconnected"}
              />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <aside className="w-36 shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-800">
              {conversations.length === 0 ? (
                <div className="p-3 text-xs text-slate-500">No chats yet</div>
              ) : (
                conversations.map((c) => {
                  const unread = c.unreadCount ?? 0;
                  return (
                    <button
                      key={c.conversationId}
                      type="button"
                      onClick={() => setActiveId(c.conversationId)}
                      className={`block w-full border-b border-slate-100 px-2 py-2 text-left text-xs dark:border-slate-800 ${
                        activeId === c.conversationId
                          ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{previewLabel(c)}</span>
                        {unread > 0 && (
                          <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[10px] text-slate-500">
                        {c.lastMessagePreview || "—"}
                      </div>
                    </button>
                  );
                })
              )}
            </aside>

            <div className="flex flex-1 flex-col">
              <div
                ref={scrollRef}
                className="flex-1 space-y-2 overflow-y-auto p-3 text-sm"
              >
                {loading ? (
                  <div className="text-xs text-slate-500">Loading…</div>
                ) : messages.length === 0 ? (
                  <div className="text-xs text-slate-500">No messages yet.</div>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderId === myUserId;
                    const isEditing = editingId === m.messageId;
                    return (
                      <div key={m.messageId} className="group flex flex-col">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                          <span>{m.senderId}</span>
                          <span>·</span>
                          <span>{fmtTime(m.createdAt)}</span>
                          {m.editedAt && !m.deletedAt && (
                            <span className="italic">(edited)</span>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="mt-1 flex items-center gap-1">
                            <input
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleSaveEdit();
                                } else if (e.key === "Escape") {
                                  setEditingId(null);
                                  setEditingText("");
                                }
                              }}
                              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveEdit()}
                              className="rounded-md bg-emerald-600 p-1 text-white"
                              aria-label="Save edit"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1">
                            <div
                              className={`max-w-full whitespace-pre-wrap break-words rounded-lg px-2 py-1 ${
                                m.deletedAt
                                  ? "italic text-slate-400"
                                  : "bg-slate-100 dark:bg-slate-800"
                              }`}
                            >
                              {m.deletedAt ? "Message deleted" : m.body}
                            </div>
                            {!m.deletedAt && (
                              <div className="relative flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReactingFor(
                                      reactingFor === m.messageId
                                        ? null
                                        : m.messageId
                                    )
                                  }
                                  className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  aria-label="React"
                                >
                                  <Smile className="h-3 w-3" />
                                </button>
                                {mine && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingId(m.messageId);
                                        setEditingText(m.body);
                                      }}
                                      className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                                      aria-label="Edit"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleDelete(m.messageId)
                                      }
                                      className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                                      aria-label="Delete"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                                {reactingFor === m.messageId && (
                                  <div className="absolute top-6 right-0 z-10 flex gap-0.5 rounded-md border border-slate-200 bg-white p-1 shadow-md dark:border-slate-700 dark:bg-slate-800">
                                    {QUICK_REACTIONS.map((e) => (
                                      <button
                                        key={e}
                                        type="button"
                                        onClick={() =>
                                          void handleReact(m.messageId, e)
                                        }
                                        className="rounded p-0.5 text-base hover:bg-slate-100 dark:hover:bg-slate-700"
                                      >
                                        {e}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {!m.deletedAt &&
                          m.reactions &&
                          Object.keys(m.reactions).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(m.reactions).map(
                                ([emoji, users]) => {
                                  if (!users || users.length === 0) return null;
                                  const reacted =
                                    !!myUserId && users.includes(myUserId);
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() =>
                                        void handleReact(m.messageId, emoji)
                                      }
                                      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs ${
                                        reacted
                                          ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-300"
                                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                      }`}
                                    >
                                      <span>{emoji}</span>
                                      <span>{users.length}</span>
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-slate-200 p-2 dark:border-slate-800">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={
                    activeId ? "Type a message…" : "Select a conversation"
                  }
                  disabled={!activeId || sending}
                  className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!activeId || !input.trim() || sending}
                  className="rounded-md bg-indigo-600 p-1.5 text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
