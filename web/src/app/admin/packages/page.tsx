"use client";

import { useEffect, useState } from "react";
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
import { PageHeader } from "@/components/shell";
import { ChannelBadge } from "@/components/channel-badge";
import type { Package, PackageChannel, User } from "@/lib/types";

const EMPTY = {
  name: "",
  description: "",
  type: "ONE_TIME",
  channel: "COMBINED" as PackageChannel,
  isGlobal: false,
  consultantIds: [] as string[],
  price: 0,
  currency: "PKR",
  textLimit: "",
  audioLimit: "",
  videoLimit: "",
  sessionLimit: "",
  sessionDuration: "",
  audioDuration: "",
  videoDuration: "",
  responseAllowance: "",
  textWordLimit: "",
  consultationMode: "CHAT",
};

// Convert blank string to null (=> unlimited), otherwise number.
function num(v: string) {
  return v === "" ? null : Number(v);
}

// Which limit inputs are relevant for the selected channel.
function channelAllows(
  channel: PackageChannel,
  kind: "text" | "audio" | "video",
) {
  if (channel === "COMBINED") return true;
  return channel === kind.toUpperCase();
}

export default function AdminPackages() {
  const [list, setList] = useState<Package[] | null>(null);
  const [consultants, setConsultants] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  async function load() {
    try {
      const [pkgs, people] = await Promise.all([
        api<Package[]>("/packages/all"),
        api<User[]>("/users/consultants"),
      ]);
      setList(pkgs);
      setConsultants(people);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setShow(true);
  }

  function openEdit(p: Package) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      type: p.type,
      channel: p.channel,
      isGlobal: p.isGlobal,
      consultantIds: (p.consultants ?? []).map((c) => c.id),
      price: p.price,
      currency: p.currency,
      textLimit: p.textLimit ?? "",
      audioLimit: p.audioLimit ?? "",
      videoLimit: p.videoLimit ?? "",
      sessionLimit: p.sessionLimit ?? "",
      sessionDuration: p.sessionDuration ?? "",
      audioDuration: p.audioDuration ?? "",
      videoDuration: p.videoDuration ?? "",
      responseAllowance: p.responseAllowance ?? "",
      textWordLimit: p.textWordLimit ?? "",
      consultationMode: p.consultationMode ?? "CHAT",
    });
    setShow(true);
  }

  function toggleConsultant(id: string) {
    setForm((f: any) => ({
      ...f,
      consultantIds: f.consultantIds.includes(id)
        ? f.consultantIds.filter((c: string) => c !== id)
        : [...f.consultantIds, id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      name: form.name,
      description: form.description,
      type: form.type,
      channel: form.channel,
      isGlobal: form.isGlobal,
      consultantIds: form.isGlobal ? [] : form.consultantIds,
      price: Number(form.price),
      currency: form.currency,
      textLimit: num(form.textLimit),
      audioLimit: num(form.audioLimit),
      videoLimit: num(form.videoLimit),
      sessionLimit: num(form.sessionLimit),
      sessionDuration: num(form.sessionDuration),
      audioDuration: num(form.audioDuration),
      videoDuration: num(form.videoDuration),
      responseAllowance: num(form.responseAllowance),
      textWordLimit: num(form.textWordLimit),
      consultationMode: form.consultationMode,
    };
    try {
      if (editingId) {
        await api(`/packages/${editingId}`, { method: "PATCH", body });
      } else {
        await api("/packages", { method: "POST", body });
      }
      setShow(false);
      setEditingId(null);
      setForm(EMPTY);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: string) {
    await api(`/packages/${id}`, { method: "DELETE" });
    load();
  }

  if (!list) return <Spinner />;

  const channel = form.channel as PackageChannel;
  const limitField = (
    key: string,
    label: string,
    disabled = false,
    hint?: string,
  ) => (
    <div>
      <Input
        label={label}
        type="number"
        min={0}
        placeholder={disabled ? "not in this channel" : "unlimited"}
        value={disabled ? "" : form[key]}
        disabled={disabled}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Service packages"
        subtitle="Configure plans per channel and assign them to consultants. Leave a limit blank for unlimited; set 0 to disallow a channel."
        action={<Button onClick={openCreate}>Add package</Button>}
      />
      <ErrorText message={error} />
      {show ? (
        <Card className="mb-4">
          <form
            onSubmit={submit}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Select
              label="Billing type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="ONE_TIME">One-time consultation</option>
              <option value="MONTHLY">Monthly mentorship</option>
              <option value="ANNUAL">Annual mentorship</option>
              <option value="CUSTOM">Custom</option>
            </Select>
            <Select
              label="Channel"
              value={form.channel}
              onChange={(e) =>
                setForm({ ...form, channel: e.target.value as PackageChannel })
              }
            >
              <option value="TEXT">Text only</option>
              <option value="AUDIO">Audio only</option>
              <option value="VIDEO">Video only</option>
              <option value="COMBINED">Combined (all channels)</option>
            </Select>
            <Select
              label="Consultation model"
              value={form.consultationMode}
              onChange={(e) =>
                setForm({ ...form, consultationMode: e.target.value })
              }
            >
              <option value="CHAT">Ongoing chat (back-and-forth)</option>
              <option value="SINGLE">One-time submission (Book a Chat)</option>
            </Select>
            <Input
              label="Price"
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
            <Input
              label="Currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
            <div />
            {limitField(
              "textLimit",
              "Text messages",
              !channelAllows(channel, "text"),
            )}
            {limitField(
              "textWordLimit",
              "Words per text msg",
              !channelAllows(channel, "text"),
            )}
            {limitField(
              "audioLimit",
              "Audio messages",
              !channelAllows(channel, "audio"),
            )}
            {limitField(
              "videoLimit",
              "Video messages",
              !channelAllows(channel, "video"),
            )}
            {limitField("sessionLimit", "Live sessions")}
            {limitField("sessionDuration", "Session minutes")}
            {limitField(
              "audioDuration",
              "Audio max secs",
              !channelAllows(channel, "audio"),
            )}
            {limitField(
              "videoDuration",
              "Video max secs",
              !channelAllows(channel, "video"),
            )}
            {limitField("responseAllowance", "Response allowance")}
            <Textarea
              label="Description"
              className="md:col-span-3"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />

            {/* Assignment: global toggle + consultant multi-select */}
            <div className="md:col-span-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand focus:ring-brand"
                  checked={form.isGlobal}
                  onChange={(e) =>
                    setForm({ ...form, isGlobal: e.target.checked })
                  }
                />
                Available with all consultants (global)
              </label>
              {!form.isGlobal ? (
                <fieldset className="mt-2 rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-medium text-slate-700">
                    Assigned consultants
                  </legend>
                  {consultants.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No consultants yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {consultants.map((c) => (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand focus:ring-brand"
                            checked={form.consultantIds.includes(c.id)}
                            onChange={() => toggleConsultant(c.id)}
                          />
                          {c.name}
                          {c.title ? (
                            <span className="text-slate-400">· {c.title}</span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              ) : null}
            </div>

            <div className="flex gap-2 md:col-span-3">
              <Button type="submit">
                {editingId ? "Save changes" : "Create package"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShow(false);
                  setEditingId(null);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {list.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">
          No packages yet. Click “Add package” to create your first plan.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.name}</p>
                    <ChannelBadge channel={p.channel} />
                    {p.isGlobal ? <Badge color="blue">Global</Badge> : null}
                    {!p.isActive ? <Badge color="slate">Inactive</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{p.description}</p>
                </div>
                <Badge color="amber">{p.type}</Badge>
              </div>
              <p className="mt-2 text-lg font-bold text-brand">
                {p.currency} {p.price.toLocaleString()}
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-600">
                <li>Text: {p.textLimit ?? "Unlimited"}</li>
                <li>Audio: {p.audioLimit ?? "Unlimited"}</li>
                <li>Video: {p.videoLimit ?? "Unlimited"}</li>
                <li>Sessions: {p.sessionLimit ?? "Unlimited"}</li>
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                {p.isGlobal
                  ? "Offered by every consultant"
                  : p.consultants && p.consultants.length > 0
                    ? `Consultants: ${p.consultants.map((c) => c.name).join(", ")}`
                    : "No consultants assigned yet"}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" onClick={() => openEdit(p)}>
                  Edit
                </Button>
                {p.isActive ? (
                  <Button variant="danger" onClick={() => remove(p.id)}>
                    Deactivate
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
