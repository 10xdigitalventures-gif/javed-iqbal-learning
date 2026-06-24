"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorText, Input, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type EnvField = { key: string; label: string; secret?: boolean };
type EnvGroup = { key: string; title: string; hint?: string; fields: EnvField[] };
type EnvConfig = { groups: EnvGroup[]; values: Record<string, string> };

export default function AdminSettings() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Env-style config (payment + storage).
  const [env, setEnv] = useState<EnvConfig | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<string | null>(null);

  useEffect(() => {
    api<Record<string, string>>("/settings")
      .then(setValues)
      .catch(() => {});
    api<EnvConfig>("/settings/env")
      .then(setEnv)
      .catch((e) => setEnvError(e.message));
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
              Switches the logo shown inside the apps (applies live, no rebuild).
              The phone launcher icon &amp; splash screen use the photo baked
              into the latest app build.
            </p>
          </div>
          {Object.keys(values)
            .filter((key) => key !== "brandingMode")
            .map((key) => (
            <Input
              key={key}
              label={key}
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
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
          {env.groups.map((group) => (
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
                    placeholder={f.secret ? "\u2022\u2022\u2022\u2022\u2022\u2022" : undefined}
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
