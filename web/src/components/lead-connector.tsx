"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

// Site-wide LeadConnector (HighLevel) chat widget.
//
// Next.js equivalent of the official LeadConnector WordPress plugin's chat
// widget embed. Two modes, both configured from Admin → Settings →
// LeadConnector and mounted globally from the root layout:
//   1. Connected account (OAuth): we know the location id — render the
//      <chat-widget location-id="…"> element and let loader.js hydrate it.
//   2. Manual Widget ID: load loader.js with data-resources-url + data-widget-id.
export function LeadConnector() {
  useEffect(() => {
    let cancelled = false;
    api<Record<string, string>>("/settings")
      .then((s) => {
        if (cancelled) return;
        if (s.leadConnectorEnabled !== "true") return;
        if (document.getElementById("leadconnector-chat-widget")) return;

        const widgetId = (s.leadConnectorWidgetId || "").trim();
        const locationId = (s.leadConnectorLocationId || "").trim();
        if (!widgetId && !locationId) return;

        const loaderUrl =
          s.leadConnectorLoaderUrl ||
          "https://widgets.leadconnectorhq.com/loader.js";
        const resourcesUrl =
          s.leadConnectorResourcesUrl ||
          "https://widgets.leadconnectorhq.com/chat-widget/loader.js";

        if (widgetId) {
          const script = document.createElement("script");
          script.id = "leadconnector-chat-widget";
          script.src = loaderUrl;
          script.setAttribute("data-resources-url", resourcesUrl);
          script.setAttribute("data-widget-id", widgetId);
          document.body.appendChild(script);
        } else {
          const el = document.createElement("chat-widget");
          el.setAttribute("location-id", locationId);
          document.body.appendChild(el);
          const script = document.createElement("script");
          script.id = "leadconnector-chat-widget";
          script.src = loaderUrl;
          document.body.appendChild(script);
        }
      })
      .catch(() => {
        // best-effort — never block the app if settings fail to load
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
