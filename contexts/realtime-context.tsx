"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getWsClient, WSClient } from "@/lib/ws";

type RealtimeValue = {
  client: WSClient | null;
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeValue>({
  client: null,
  connected: false,
});

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  "wss://REPLACE-ME.execute-api.ap-southeast-3.amazonaws.com/prod";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [client, setClient] = useState<WSClient | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubStatus: (() => void) | null = null;
    let wsClient: WSClient | null = null;

    async function init() {
      try {
        const res = await fetch("/api/auth/ws-ticket");
        if (!res.ok) return;
        const data = (await res.json()) as { token: string };
        if (cancelled) return;
        tokenRef.current = data.token;

        wsClient = getWsClient({
          url: WS_URL,
          getToken: () => tokenRef.current,
        });
        setClient(wsClient);
        unsubStatus = wsClient.onStatus(setConnected);
        wsClient.connect();
      } catch (err) {
        console.error("Realtime init failed", err);
      }
    }

    void init();

    return () => {
      cancelled = true;
      unsubStatus?.();
      wsClient?.disconnect();
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ client, connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
