"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";

export type Offer = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  accessDurationDays?: number | null;
  isActive: boolean;
  index: number;
};

function durationLabel(d?: number | null) {
  if (d == null || d === 0) return "Lifetime";
  if (d % 365 === 0) return `${d / 365} year(s)`;
  if (d % 30 === 0) return `${d / 30} month(s)`;
  return `${d} day(s)`;
}

// A small self-contained modal so this component has no external dependency.
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold text-slate-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// Generic offers/plans manager reused for community plans and bundle offers.
// listUrl loads offers for the parent; createUrl accepts a POST with parentKey;
// mutateBase + /:id is used for PATCH and DELETE.
export function OfferManager({
  listUrl,
  createUrl,
  mutateBase,
  parentKey,
  parentId,
  label = "Plans",
  hint,
}: {
  listUrl: string;
  createUrl: string;
  mutateBase: string;
  parentKey: string;
  parentId: string;
  label?: string;
  hint?: string;
}) {
  const [rows, setRows] = useState<Offer[] | null>(null);
  const [editing, setEditing] = useState<Partial<Offer> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await api<Offer[]>(listUrl));
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listUrl]);

  function startNew() {
    setErr(null);
    setEditing({
      name: "",
      price: 0,
      currency: "PKR",
      accessDurationDays: null,
      isActive: true,
      index: rows?.length || 0,
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const body: any = {
        name: editing.name,
        description: editing.description || null,
        price: Number(editing.price) || 0,
        currency: editing.currency || "PKR",
        accessDurationDays:
          editing.accessDurationDays == null ||
          (editing.accessDurationDays as any) === ""
            ? null
            : Number(editing.accessDurationDays),
        isActive: editing.isActive ?? true,
        index: Number(editing.index) || 0,
      };
      if (editing.id) {
        await api(`${mutateBase}/${editing.id}`, { method: "PATCH", body });
      } else {
        await api(createUrl, {
          method: "POST",
          body: { ...body, [parentKey]: parentId },
        });
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message || "Could not save plan");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this plan?")) return;
    await api(`${mutateBase}/${id}`, { method: "DELETE" });
    await load();
  }

  if (!rows) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
          {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
        </div>
        <Button onClick={startNew}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-slate-500">
          No plans yet. Create pricing tiers like 1 Month, 3 Months or Lifetime.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((o) => (
          <Card key={o.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {o.name}
                </p>
                <p className="text-xs text-slate-500">
                  {durationLabel(o.accessDurationDays)} access
                </p>
              </div>
              <Badge color={o.isActive ? "green" : "slate"}>
                {o.isActive ? "Active" : "Hidden"}
              </Badge>
            </div>
            {o.description && (
              <p className="mt-2 text-sm text-slate-600">{o.description}</p>
            )}
            <p className="mt-2 text-lg font-bold text-slate-900">
              {o.currency} {Number(o.price).toLocaleString()}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setErr(null);
                  setEditing(o);
                }}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="outline" onClick={() => remove(o.id)}>
                <Trash2 className="mr-1 h-3.5 w-3.5 text-red-500" /> Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? "Edit plan" : "New plan"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <ErrorText message={err} />
            <Input
              label="Plan name"
              value={editing.name || ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. 1 Month Access"
            />
            <Textarea
              label="Description (optional)"
              value={editing.description || ""}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
            />
            <div className="flex gap-3">
              <Input
                label="Price"
                type="number"
                value={String(editing.price ?? 0)}
                onChange={(e) =>
                  setEditing({ ...editing, price: Number(e.target.value) })
                }
              />
              <Input
                label="Currency"
                value={editing.currency || "PKR"}
                onChange={(e) =>
                  setEditing({ ...editing, currency: e.target.value })
                }
              />
            </div>
            <Select
              label="Access duration"
              value={
                editing.accessDurationDays == null
                  ? ""
                  : String(editing.accessDurationDays)
              }
              onChange={(e) =>
                setEditing({
                  ...editing,
                  accessDurationDays:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Lifetime</option>
              <option value="7">7 days</option>
              <option value="15">15 days</option>
              <option value="30">1 month</option>
              <option value="90">3 months</option>
              <option value="180">6 months</option>
              <option value="365">1 year</option>
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editing.isActive ?? true}
                onChange={(e) =>
                  setEditing({ ...editing, isActive: e.target.checked })
                }
              />
              Active (visible to buyers)
            </label>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={busy || !editing.name}>
                {busy ? "Saving..." : "Save plan"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
