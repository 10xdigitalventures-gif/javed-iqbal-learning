"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, ErrorText, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Slot = { weekday: number; startTime: string; endTime: string };

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function ConsultantAvailability() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    const data = await api<Slot[]>(`/meetings/availability/${user.id}`);
    setSlots(data.length ? data : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function addSlot() {
    setSlots([
      ...(slots || []),
      { weekday: 1, startTime: "09:00", endTime: "17:00" },
    ]);
  }

  function update(i: number, key: keyof Slot, value: string) {
    const next = [...(slots || [])];
    (next[i] as any)[key] = key === "weekday" ? Number(value) : value;
    setSlots(next);
  }

  function remove(i: number) {
    setSlots((slots || []).filter((_, idx) => idx !== i));
  }

  async function save() {
    setError(null);
    setInfo(null);
    try {
      await api("/meetings/availability", {
        method: "POST",
        body: { slots },
      });
      setInfo("Availability saved");
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (!slots) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Availability"
        subtitle="Set your weekly available hours for bookings"
        action={<Button onClick={addSlot}>Add slot</Button>}
      />
      <Card>
        <div className="space-y-3">
          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <select
                value={s.weekday}
                onChange={(e) => update(i, "weekday", e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {DAYS.map((d, idx) => (
                  <option key={idx} value={idx}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={s.startTime}
                onChange={(e) => update(i, "startTime", e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="text-slate-400">to</span>
              <input
                type="time"
                value={s.endTime}
                onChange={(e) => update(i, "endTime", e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <Button variant="outline" onClick={() => remove(i)}>
                Remove
              </Button>
            </div>
          ))}
          {slots.length === 0 ? (
            <p className="text-sm text-slate-400">
              No slots set. Add your available hours.
            </p>
          ) : null}
          <ErrorText message={error} />
          {info ? <p className="text-sm text-green-700">{info}</p> : null}
          <Button onClick={save}>Save availability</Button>
        </div>
      </Card>
    </div>
  );
}
