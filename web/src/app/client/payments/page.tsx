"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  kind: string;
  invoiceNo?: string;
  createdAt: string;
  purchase?: { package?: { name: string } };
};

const color: Record<string, any> = {
  PAID: "green",
  PENDING: "amber",
  FAILED: "red",
  REFUNDED: "slate",
};

export default function ClientPayments() {
  const [list, setList] = useState<Payment[] | null>(null);

  useEffect(() => {
    api<Payment[]>("/payments/mine")
      .then(setList)
      .catch(() => setList([]));
  }, []);

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Your payment history and invoices"
      />
      <div className="space-y-2">
        {list.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{p.purchase?.package?.name}</p>
                <p className="text-xs text-slate-500">
                  {p.invoiceNo} · {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">
                  {p.currency} {p.amount.toLocaleString()}
                </span>
                <Badge color={color[p.status]}>{p.status}</Badge>
              </div>
            </div>
          </Card>
        ))}
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">No payments yet.</p>
        ) : null}
      </div>
    </div>
  );
}
