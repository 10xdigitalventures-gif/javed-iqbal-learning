"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorText, Input, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

export default function AdminSettings() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    api<Record<string, string>>("/settings")
      .then(setValues)
      .catch(() => {});
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

  if (!values) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Platform settings"
        subtitle="Configure global platform options"
      />
      <Card>
        <form onSubmit={save} className="grid grid-cols-2 gap-4">
          {Object.keys(values).map((key) => (
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
    </div>
  );
}
