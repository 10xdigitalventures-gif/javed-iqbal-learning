"use client";

import { useEffect } from "react";

// Reusable LeadConnector (HighLevel) embed for forms, surveys, quizzes,
// calendars and funnel steps. Pass the share/embed URL from LeadConnector and
// this renders the responsive iframe and loads the form_embed.js helper that
// LeadConnector uses to auto-size embeds — the same script the WordPress plugin
// enqueues (link.msgsndr.com/js/form_embed.js).
const FORM_EMBED_SCRIPT = "https://link.msgsndr.com/js/form_embed.js";

export function LeadConnectorEmbed({
  src,
  title,
  height = 640,
}: {
  src: string;
  title?: string;
  height?: number | string;
}) {
  useEffect(() => {
    if (document.getElementById("leadconnector-form-embed")) return;
    const s = document.createElement("script");
    s.id = "leadconnector-form-embed";
    s.src = FORM_EMBED_SCRIPT;
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return (
    <iframe
      src={src}
      title={title || "LeadConnector"}
      className="w-full rounded-xl border border-slate-200"
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      scrolling="no"
      allow="clipboard-write; camera; microphone; geolocation; autoplay"
    />
  );
}
