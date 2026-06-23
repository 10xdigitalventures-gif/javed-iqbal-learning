"use client";

import clsx from "clsx";
import { MessageSquare, Mic, Video, Layers } from "lucide-react";
import type { PackageChannel } from "@/lib/types";

const CONFIG: Record<
  PackageChannel,
  { label: string; className: string; Icon: typeof MessageSquare }
> = {
  TEXT: {
    label: "Text",
    className: "bg-blue-100 text-blue-700",
    Icon: MessageSquare,
  },
  AUDIO: {
    label: "Audio",
    className: "bg-violet-100 text-violet-700",
    Icon: Mic,
  },
  VIDEO: {
    label: "Video",
    className: "bg-rose-100 text-rose-700",
    Icon: Video,
  },
  COMBINED: {
    label: "Combined",
    className: "bg-emerald-100 text-emerald-700",
    Icon: Layers,
  },
};

// Small labelled badge with an icon for a plan's communication channel.
export function ChannelBadge({ channel }: { channel: PackageChannel }) {
  const cfg = CONFIG[channel] ?? CONFIG.COMBINED;
  const { Icon } = cfg;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        cfg.className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
