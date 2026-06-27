"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Spinner } from "@/components/ui";

type Pref = {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
  mutedTypes: string[];
};

type ChannelKey = "inApp" | "email" | "sms" | "whatsapp" | "push";

const CHANNELS: Array<{
  key: ChannelKey;
  label: string;
  hint: string;
}> = [
  {
    key: "inApp",
    label: "In-app",
    hint: "Alerts inside the app and on the web",
  },
  {
    key: "email",
    label: "Email",
    hint: "Important updates sent to your inbox",
  },
  { key: "sms", label: "SMS", hint: "Text messages to your phone number" },
  {
    key: "whatsapp",
    label: "WhatsApp",
    hint: "Messages to your WhatsApp number",
  },
  { key: "push", label: "Push", hint: "Mobile push notifications" },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={
        "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
        (on ? "bg-brand" : "bg-slate-300")
      }
    >
      <span
        className={
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
          (on ? "left-[22px]" : "left-0.5")
        }
      />
    </button>
  );
}

export function NotificationPreferences() {
  const [pref, setPref] = useState<Pref | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    api<Pref>("/notifications/preferences")
      .then((p) =>
        setPref({
          inApp: p.inApp,
          email: p.email,
          sms: p.sms,
          whatsapp: p.whatsapp,
          push: p.push,
          mutedTypes: p.mutedTypes || [],
        }),
      )
      .catch(() =>
        setPref({
          inApp: true,
          email: true,
          sms: false,
          whatsapp: false,
          push: true,
          mutedTypes: [],
        }),
      );
  }, []);

  async function toggle(key: ChannelKey) {
    if (!pref) return;
    const next = { ...pref, [key]: !pref[key] };
    setPref(next);
    setSaving(true);
    setSavedAt(null);
    try {
      await api("/notifications/preferences", {
        method: "PATCH",
        body: { [key]: next[key] },
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTestMsg(null);
    try {
      await api("/notifications/test", { method: "POST" });
      setTestMsg(
        "Test sent. Check your enabled channels (email/SMS/WhatsApp use mock mode until configured).",
      );
    } catch {
      setTestMsg("Could not send the test notification.");
    }
  }

  if (!pref) return <Spinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-950">Delivery preferences</h3>
          <p className="text-sm text-slate-500">
            Choose how you want to be notified. SMS and WhatsApp use the phone
            number on your account.
          </p>
        </div>
        {saving ? (
          <span className="text-xs text-slate-400">Saving…</span>
        ) : savedAt ? (
          <span className="text-xs text-green-600">Saved</span>
        ) : null}
      </div>

      <div className="divide-y divide-slate-100">
        {CHANNELS.map((c) => (
          <div key={c.key} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-slate-800">{c.label}</p>
              <p className="text-xs text-slate-500">{c.hint}</p>
            </div>
            <Toggle on={pref[c.key]} onClick={() => toggle(c.key)} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" onClick={sendTest}>
          Send test notification
        </Button>
        {testMsg ? (
          <span className="text-xs text-slate-500">{testMsg}</span>
        ) : null}
      </div>
    </Card>
  );
}
