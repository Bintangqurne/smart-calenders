"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageSquare } from "lucide-react";
import {
  getOrCreateThread,
  listMessages,
  sendMessage,
  type Conversation,
  type Message,
} from "@/lib/api";
import { ulid } from "@/lib/ulid";
import { useRealtime } from "@/contexts/realtime-context";

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function readMyUserId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)user_id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

interface Props {
  fileId: string;
}

export function FileCommentsPanel({ fileId }: Props) {
  const { client } = useRealtime();
  const myUserId = readMyUserId();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const { messages: list } = await listMessages(conversationId, { limit: 100 });
      setMessages(list);
    } catch (err) {
      console.error("listMessages failed", err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const c = await getOrCreateThread("file", fileId);
        setConv(c);
        await loadMessages(c.conversationId);
      } catch (err: any) {
        console.error("getOrCreateThread failed", err);
        setError(err?.message ?? "Failed to load comments");
      } finally {
        setLoading(false);
      }
    })();
  }, [fileId, loadMessages]);

  useEffect(() => {
    if (!client || !conv) return;
    client.subscribe(conv.conversationId);
    const off = client.on("message.new", (msg: any) => {
      if (msg.conversationId !== conv.conversationId) return;
      const incoming = msg.message as Message;
      setMessages((prev) => {
        if (prev.some((m) => m.messageId === incoming.messageId)) return prev;
        return [...prev, incoming];
      });
    });
    return () => {
      off();
      client.unsubscribe(conv.conversationId);
    };
  }, [client, conv]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    if (!conv || !input.trim() || sending) return;
    const body = input.trim();
    setSending(true);
    setInput("");
    try {
      const sent = await sendMessage(conv.conversationId, {
        body,
        clientMsgId: ulid(),
      });
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading comments…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-rose-600">{error}</div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-slate-500">
            <MessageSquare className="mb-2 h-8 w-8 text-slate-400" />
            No comments yet. Start the conversation.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === myUserId;
            return (
              <div
                key={m.messageId}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                  <span>{m.senderId}</span>
                  <span>·</span>
                  <span>{fmtTime(m.createdAt)}</span>
                </div>
                <div
                  className={`max-w-[75%] whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-sm ${
                    m.deletedAt
                      ? "italic text-slate-400"
                      : mine
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  {m.deletedAt ? "Comment deleted" : m.body}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Add a comment…"
          disabled={sending || !conv}
          className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!conv || !input.trim() || sending}
          className="rounded-md bg-indigo-600 p-2 text-white transition hover:bg-indigo-700 disabled:opacity-50"
          aria-label="Send comment"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
