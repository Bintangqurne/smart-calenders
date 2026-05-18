"use client";

import { useMemo } from "react";
import { X } from "lucide-react";

interface JitsiEmbedProps {
  meetingId: string;
  meetingTitle: string;
  displayName?: string;
  email?: string;
  onClose: () => void;
}

const JITSI_DOMAIN = "meet.jit.si";

export function JitsiEmbed({
  meetingId,
  meetingTitle,
  displayName,
  email,
  onClose,
}: JitsiEmbedProps) {
  const room = `smart-${meetingId}`;
  const src = useMemo(() => {
    const cfg: Record<string, string | boolean> = {
      "config.prejoinPageEnabled": true,
      "config.startWithAudioMuted": true,
      "config.disableDeepLinking": true,
      "interfaceConfig.SHOW_JITSI_WATERMARK": false,
      "interfaceConfig.MOBILE_APP_PROMO": false,
    };
    const params = Object.entries(cfg)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&");

    const userInfo: string[] = [];
    if (displayName) {
      userInfo.push(`userInfo.displayName=${encodeURIComponent(`"${displayName}"`)}`);
    }
    if (email) {
      userInfo.push(`userInfo.email=${encodeURIComponent(`"${email}"`)}`);
    }
    const hash = [params, ...userInfo].filter(Boolean).join("&");
    return `https://${JITSI_DOMAIN}/${encodeURIComponent(room)}#${hash}`;
  }, [room, displayName, email]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{meetingTitle}</div>
          <div className="text-[10px] text-slate-400">Room: {room}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium hover:bg-rose-700"
        >
          <X className="h-3.5 w-3.5" />
          Leave
        </button>
      </header>
      <iframe
        src={src}
        title={`Smart Meet: ${meetingTitle}`}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        className="flex-1 border-0"
      />
    </div>
  );
}
