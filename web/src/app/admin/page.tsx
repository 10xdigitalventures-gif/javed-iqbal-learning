"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CreditCard, MessageSquare, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Overview = {
  clients: number;
  consultants: number;
  activePurchases: number;
  meetings: number;
  messages: number;
  communities: number;
  revenue: number;
};

const cards = [
  { key: "clients", label: "Clients", icon: Users },
  { key: "consultants", label: "Consultants", icon: Users },
  { key: "activePurchases", label: "Active packages", icon: CreditCard },
  { key: "meetings", label: "Meetings", icon: CalendarClock },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "communities", label: "Communities", icon: Users },
] as const;

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api<Overview>("/reports/admin/overview")
      .then(setData)
      .catch(() =>
        setData({ clients: 0, consultants: 0, activePurchases: 0, meetings: 0, messages: 0, communities: 0, revenue: 0 }),
      );
  }, []);

  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Admin dashboard" subtitle="Platform health, usage, and revenue overview" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-3 bg-gradient-to-r from-brand to-brand-dark text-white">
          <p className="text-sm text-blue-100">Total paid revenue</p>
          <p className="mt-2 text-3xl font-bold">PKR {Number(data.revenue || 0).toLocaleString()}</p>
        </Card>
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.key}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{Number(data[item.key]).toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-brand-light p-3 text-brand-dark">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
