"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { User } from "@/lib/types";

export default function ConsultantClients() {
  const [list, setList] = useState<User[] | null>(null);

  useEffect(() => {
    api<User[]>("/users/my-clients")
      .then(setList)
      .catch(() => setList([]));
  }, []);

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader title="My clients" subtitle="Clients assigned to you" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.map((u) => (
          <Card key={u.id}>
            <p className="font-medium">{u.name}</p>
            <p className="text-sm text-slate-500">{u.email}</p>
          </Card>
        ))}
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">No clients yet.</p>
        ) : null}
      </div>
    </div>
  );
}
