"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Button,
  Card,
  ErrorText,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";

type EnvField = { key: string; label: string; secret?: boolean };
type EnvGroup = {
  key: string;
  title: string;
  hint?: string;
  fields: EnvField[];
};
type EnvConfig = { groups: EnvGroup[]; values: Record<string, string> };
type LcStatus = {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  locationId: string;
  locationName: string;
  widgetId: string;
  redirectUri: string;
};

export default function AdminSettings() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Env-style config (payment + storage).
  const [env, setEnv] = useState<EnvConfig | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<string | null>(null);

  // Hawwa AI card feedback.
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<string | null>(null);

  // LeadConnector card feedback.
  const [lcErr, setLcErr] = useState<string | null>(null);
  const [lcInfo, setLcInfo] = useState<string | null>(null);
  const [lcStatus, setLcStatus] = useState<LcStatus | null>(null);
  const [mcpErr, setMcpErr] = useState<string | null>(null);
  const [mcpInfo, setMcpInfo] = useState<string | null>(null);
  const [mcpTools, setMcpTools] = useState<
    { name: string; description?: string }[] | null
  >(null);

  useEffect(() => {
    api<Record<string, string>>("/settings")
      .then(setValues)
      .catch(() => {});
    api<EnvConfig>("/settings/env")
      .then(setEnv)
      .catch((e) => setEnvError(e.message));
    loadLcStatus();
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const lc = p.get("lc");
      if (lc === "connected")
        setLcInfo("LeadConnector connected successfully.");
      else if (lc === "error")
        setLcErr(
          "LeadConnector connection failed: " + (p.get("lc_msg") || "unknown"),
        );
    }
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api("/settings", { method: "PUT", body: values });
      setInfo("Settings saved");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveEnv(e: React.FormEvent) {
    e.preventDefault();
    setEnvError(null);
    setEnvInfo(null);
    if (!env) return;
    try {
      const updated = await api<EnvConfig>("/settings/env", {
        method: "PUT",
        body: env.values,
      });
      setEnv(updated);
      setEnvInfo("Saved \u2013 applied to the running server.");
    } catch (err: any) {
      setEnvError(err.message);
    }
  }

  async function saveAi(e: React.FormEvent) {
    e.preventDefault();
    setAiErr(null);
    setAiInfo(null);
    if (!values) return;
    try {
      await api("/settings", {
        method: "PUT",
        body: {
          aiName: values.aiName || "Hawwa",
          aiPersonality: values.aiPersonality || "",
          aiEnabled: values.aiEnabled || "true",
        },
      });
      if (env) {
        const updated = await api<EnvConfig>("/settings/env", {
          method: "PUT",
          body: {
            AI_PROVIDER: env.values.AI_PROVIDER || "",
            AI_API_KEY: env.values.AI_API_KEY || "",
            AI_MODEL: env.values.AI_MODEL || "",
            AI_BASE_URL: env.values.AI_BASE_URL || "",
          },
        });
        setEnv(updated);
      }
      setAiInfo("Hawwa AI settings saved – applied live.");
    } catch (err: any) {
      setAiErr(err.message);
    }
  }

  async function loadLcStatus() {
    try {
      setLcStatus(await api<LcStatus>("/leadconnector/status"));
    } catch {
      // admin may not have configured LeadConnector yet
    }
  }

  async function connectLc() {
    setLcErr(null);
    setLcInfo(null);
    try {
      if (env) {
        await api<EnvConfig>("/settings/env", {
          method: "PUT",
          body: {
            LEADCONNECTOR_CLIENT_ID: env.values.LEADCONNECTOR_CLIENT_ID || "",
            LEADCONNECTOR_CLIENT_SECRET:
              env.values.LEADCONNECTOR_CLIENT_SECRET || "",
          },
        });
      }
      const r = await api<{ url?: string; error?: string }>(
        "/leadconnector/authorize",
      );
      if (r.error) {
        setLcErr(r.error);
        return;
      }
      if (r.url) window.location.href = r.url;
    } catch (err: any) {
      setLcErr(err.message);
    }
  }

  async function disconnectLc() {
    setLcErr(null);
    setLcInfo(null);
    try {
      await api("/leadconnector/disconnect", { method: "POST" });
      setLcInfo("LeadConnector disconnected.");
      loadLcStatus();
    } catch (err: any) {
      setLcErr(err.message);
    }
  }

  async function testMcp() {
    setMcpErr(null);
    setMcpInfo(null);
    setMcpTools(null);
    try {
      if (env) {
        await api<EnvConfig>("/settings/env", {
          method: "PUT",
          body: {
            LEADCONNECTOR_MCP_URL: env.values.LEADCONNECTOR_MCP_URL || "",
            LEADCONNECTOR_MCP_TOKEN: env.values.LEADCONNECTOR_MCP_TOKEN || "",
          },
        });
      }
      const tools = await api<{ name: string; description?: string }[]>(
        "/leadconnector/mcp/tools",
      );
      setMcpTools(tools);
      setMcpInfo(`Connected \u2014 ${tools.length} CRM tools available.`);
    } catch (err: any) {
      setMcpErr(err.message);
    }
  }

  async function saveLc(e: React.FormEvent) {
    e.preventDefault();
    setLcErr(null);
    setLcInfo(null);
    if (!values) return;
    try {
      await api("/settings", {
        method: "PUT",
        body: {
          leadConnectorEnabled: values.leadConnectorEnabled || "false",
          leadConnectorWidgetId: values.leadConnectorWidgetId || "",
          leadConnectorLoaderUrl: values.leadConnectorLoaderUrl || "",
          leadConnectorResourcesUrl: values.leadConnectorResourcesUrl || "",
        },
      });
      setLcInfo(
        "LeadConnector settings saved \u2013 applies on next page load.",
      );
    } catch (err: any) {
      setLcErr(err.message);
    }
  }

  function setEnvValue(key: string, value: string) {
    if (!env) return;
    setEnv({ ...env, values: { ...env.values, [key]: value } });
  }

  if (!values) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        subtitle="Configure global platform options"
      />
      <Card>
        <form onSubmit={save} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              App branding
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={values.brandingMode || "picture"}
              onChange={(e) =>
                setValues({ ...values, brandingMode: e.target.value })
              }
            >
              <option value="picture">
                Picture — Prof. Dr. Javed Iqbal photo
              </option>
              <option value="icon">Icon — app monogram</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Switches the logo shown inside the apps (applies live, no
              rebuild). The phone launcher icon &amp; splash screen use the
              photo baked into the latest app build.
            </p>
          </div>
          {Object.keys(values)
            .filter(
              (key) =>
                ![
                  "brandingMode",
                  "aiName",
                  "aiPersonality",
                  "aiEnabled",
                  "leadConnectorEnabled",
                  "leadConnectorWidgetId",
                  "leadConnectorLoaderUrl",
                  "leadConnectorResourcesUrl",
                ].includes(key),
            )
            .map((key) => (
              <Input
                key={key}
                label={key}
                value={values[key]}
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
              />
            ))}
          <div className="col-span-2">
            <ErrorText message={error} />
            {info ? (
              <p className="mb-2 text-sm text-green-700">{info}</p>
            ) : null}
            <Button type="submit">Save settings</Button>
          </div>
        </form>
      </Card>

      <PageHeader
        title="LeadConnector"
        subtitle="Connect your LeadConnector (HighLevel) account to add its chat widget across the web app — WordPress-plugin style. Sign in with LeadConnector (Google login supported); no manual Widget ID needed."
      />
      <Card>
        <div className="space-y-4">
          {lcStatus?.connected ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Connected to{" "}
              <strong>{lcStatus.locationName || lcStatus.locationId}</strong>.
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Not connected yet. Add your Marketplace app credentials below and
              click Connect.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Client ID"
              value={env?.values.LEADCONNECTOR_CLIENT_ID || ""}
              onChange={(e) =>
                setEnvValue("LEADCONNECTOR_CLIENT_ID", e.target.value)
              }
            />
            <Input
              label="Client Secret"
              type="password"
              placeholder="••••••"
              value={env?.values.LEADCONNECTOR_CLIENT_SECRET || ""}
              onChange={(e) =>
                setEnvValue("LEADCONNECTOR_CLIENT_SECRET", e.target.value)
              }
            />

            <Input
              label="SSO Key"
              type="password"
              placeholder="••••••"
              value={env?.values.LEADCONNECTOR_SSO_KEY || ''}
              onChange={(e) =>
                setEnvValue('LEADCONNECTOR_SSO_KEY', e.target.value)
              }
            />
          </div>
          <p className="text-xs text-gray-500">
            In your LeadConnector Marketplace app, set the Redirect URL to{" "}
            <code className="rounded bg-gray-100 px-1">
              {lcStatus?.redirectUri || "<your API URL>/leadconnector/callback"}
            </code>
            .
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={connectLc}>
              {lcStatus?.connected
                ? "Reconnect LeadConnector"
                : "Connect LeadConnector"}
            </Button>
            {lcStatus?.connected ? (
              <Button type="button" variant="outline" onClick={disconnectLc}>
                Disconnect
              </Button>
            ) : null}
          </div>
          <ErrorText message={lcErr} />
          {lcInfo ? <p className="text-sm text-green-700">{lcInfo}</p> : null}
        </div>

        <form
          onSubmit={saveLc}
          className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4"
        >
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Chat widget
            </label>
            <Select
              value={values.leadConnectorEnabled || "false"}
              onChange={(e) =>
                setValues({ ...values, leadConnectorEnabled: e.target.value })
              }
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
          </div>
          <div className="col-span-2">
            <Input
              label="Widget ID (optional — leave blank to use the connected location)"
              placeholder="e.g. 6634xxxxxxxxxxxxxxxxxxxx"
              value={values.leadConnectorWidgetId || ""}
              onChange={(e) =>
                setValues({ ...values, leadConnectorWidgetId: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <Button type="submit">Save widget options</Button>
          </div>
        </form>
      </Card>

      <PageHeader
        title="LeadConnector CRM (MCP)"
        subtitle="Optional: connect LeadConnector's MCP server so the app can use its CRM tools (contacts, calendars, conversations, opportunities). Create a Private Integration Token in LeadConnector \u2192 Settings \u2192 Private Integrations, paste it here, and Test."
      />
      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="MCP server URL"
              placeholder="https://services.leadconnectorhq.com/mcp/"
              value={env?.values.LEADCONNECTOR_MCP_URL || ""}
              onChange={(e) =>
                setEnvValue("LEADCONNECTOR_MCP_URL", e.target.value)
              }
            />
            <Input
              label="Private Integration Token"
              type="password"
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"
              value={env?.values.LEADCONNECTOR_MCP_TOKEN || ""}
              onChange={(e) =>
                setEnvValue("LEADCONNECTOR_MCP_TOKEN", e.target.value)
              }
            />
          </div>
          <p className="text-xs text-slate-500">
            Uses the connected location automatically. The token must have the
            CRM scopes you want to expose.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={testMcp}>
              Test connection
            </Button>
          </div>
          <ErrorText message={mcpErr} />
          {mcpInfo ? <p className="text-sm text-green-700">{mcpInfo}</p> : null}
          {mcpTools && mcpTools.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-1 text-xs font-medium text-slate-600">
                Available tools
              </p>
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {mcpTools.slice(0, 40).map((t) => (
                  <li key={t.name}>
                    <span className="font-mono text-[12px]">{t.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Card>

      <PageHeader
        title="Hawwa AI"
        subtitle="Connect and activate your in-app AI study companion. Changes apply live – no rebuild needed."
      />
      <Card>
        <form onSubmit={saveAi} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Status
            </label>
            <Select
              value={values.aiEnabled || "true"}
              onChange={(e) =>
                setValues({ ...values, aiEnabled: e.target.value })
              }
            >
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </Select>
          </div>
          <Input
            label="Assistant name"
            value={values.aiName || ""}
            placeholder="Hawwa"
            onChange={(e) => setValues({ ...values, aiName: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Provider
            </label>
            <Select
              value={env?.values.AI_PROVIDER || "openai"}
              onChange={(e) => setEnvValue("AI_PROVIDER", e.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="gemini">Google Gemini</option>
            </Select>
          </div>
          <Input
            label="API key"
            type="password"
            placeholder="••••••"
            value={env?.values.AI_API_KEY || ""}
            onChange={(e) => setEnvValue("AI_API_KEY", e.target.value)}
          />
          <Input
            label="Model"
            placeholder="gpt-4o-mini / openai/gpt-4o-mini / gemini-1.5-flash"
            value={env?.values.AI_MODEL || ""}
            onChange={(e) => setEnvValue("AI_MODEL", e.target.value)}
          />
          <div className="col-span-2">
            <Input
              label="API base URL (optional override)"
              placeholder="Leave blank for the provider default"
              value={env?.values.AI_BASE_URL || ""}
              onChange={(e) => setEnvValue("AI_BASE_URL", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Textarea
              label="Personality"
              value={values.aiPersonality || ""}
              placeholder="e.g. Warm, encouraging and concise; explains simply and uses simple Urdu when asked."
              onChange={(e) =>
                setValues({ ...values, aiPersonality: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <ErrorText message={aiErr} />
            {aiInfo ? (
              <p className="mb-2 text-sm text-green-700">{aiInfo}</p>
            ) : null}
            <Button type="submit">Save Hawwa AI</Button>
          </div>
        </form>
      </Card>

      <PageHeader
        title="Payment & storage"
        subtitle="Manage gateway and storage credentials. Saved values are applied to the live server immediately."
      />
      {!env ? (
        envError ? (
          <Card>
            <ErrorText message={envError} />
          </Card>
        ) : (
          <Spinner />
        )
      ) : (
        <form onSubmit={saveEnv} className="space-y-6">
          {env.groups
            .filter(
              (group) => group.key !== "ai" && group.key !== "leadconnector",
            )
            .map((group) => (
              <Card key={group.key}>
                <h3 className="mb-1 text-base font-semibold text-gray-900">
                  {group.title}
                </h3>
                {group.hint ? (
                  <p className="mb-4 text-sm text-gray-500">{group.hint}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-4">
                  {group.fields.map((f) => (
                    <Input
                      key={f.key}
                      label={f.label}
                      type={f.secret ? "password" : "text"}
                      placeholder={
                        f.secret
                          ? "\u2022\u2022\u2022\u2022\u2022\u2022"
                          : undefined
                      }
                      value={env.values[f.key] || ""}
                      onChange={(e) => setEnvValue(f.key, e.target.value)}
                    />
                  ))}
                </div>
              </Card>
            ))}
          <div>
            <ErrorText message={envError} />
            {envInfo ? (
              <p className="mb-2 text-sm text-green-700">{envInfo}</p>
            ) : null}
            <Button type="submit">Save payment & storage</Button>
          </div>
        </form>
      )}
    </div>
  );
}
