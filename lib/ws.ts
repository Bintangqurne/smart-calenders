export type WsHandler = (msg: any) => void;

export interface WSClientOptions {
  url: string;
  getToken: () => string | null;
}

const MAX_RECONNECT_DELAY = 30_000;
const HEARTBEAT_INTERVAL = 25_000;

export class WSClient {
  private ws: WebSocket | null = null;
  private opts: WSClientOptions;
  private listeners = new Map<string, Set<WsHandler>>();
  private subscriptions = new Set<string>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private resyncCallbacks = new Set<() => void>();
  private statusCallbacks = new Set<(connected: boolean) => void>();
  private connected = false;

  constructor(opts: WSClientOptions) {
    this.opts = opts;
  }

  connect() {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    const token = this.opts.getToken();
    if (!token) return;

    const url = `${this.opts.url}?token=${encodeURIComponent(token)}`;
    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error("WS construct failed", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setConnected(true);
      if (this.subscriptions.size > 0) {
        this.emit("subscribe", { conversationIds: [...this.subscriptions] });
      }
      this.startHeartbeat();
      this.resyncCallbacks.forEach((cb) => cb());
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const type = msg.type as string | undefined;
        if (!type) return;
        this.listeners.get(type)?.forEach((h) => h(msg));
        this.listeners.get("*")?.forEach((h) => h(msg));
      } catch {
        // ignore non-JSON
      }
    };

    this.ws.onclose = () => {
      this.setConnected(false);
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.setConnected(false);
  }

  on(type: string, handler: WsHandler): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
    return () => this.listeners.get(type)?.delete(handler);
  }

  emit(action: string, payload: Record<string, unknown> = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ action, ...payload }));
    return true;
  }

  subscribe(conversationId: string) {
    this.subscriptions.add(conversationId);
    this.emit("subscribe", { conversationIds: [conversationId] });
  }

  unsubscribe(conversationId: string) {
    this.subscriptions.delete(conversationId);
    this.emit("unsubscribe", { conversationIds: [conversationId] });
  }

  onResync(cb: () => void): () => void {
    this.resyncCallbacks.add(cb);
    return () => this.resyncCallbacks.delete(cb);
  }

  onStatus(cb: (connected: boolean) => void): () => void {
    this.statusCallbacks.add(cb);
    cb(this.connected);
    return () => this.statusCallbacks.delete(cb);
  }

  isConnected() {
    return this.connected;
  }

  private setConnected(v: boolean) {
    this.connected = v;
    this.statusCallbacks.forEach((cb) => cb(v));
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const base = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY);
    const jitter = Math.random() * 500;
    const delay = base + jitter;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.emit("ping");
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

let singleton: WSClient | null = null;

export function getWsClient(opts: WSClientOptions): WSClient {
  if (!singleton) singleton = new WSClient(opts);
  return singleton;
}
