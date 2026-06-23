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
  user?: { name: string; email: string };
  purchase?: { package?: { name: string } };
};

const color: Record<string, any> = {
  PAID: "green",
  PENDING: "amber",
  FAILED: "red",
  REFUNDED: "slate",
};

export default function AdminPayments() {
  const [list, setList] = useState<Payment[] | null>(null);

  useEffect(() => {
    api<Payment[]>("/payments/all")
      .then(setList)
      .catch(() => setList([]));
  }, []);

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader title="Payments" subtitle="All transactions and invoices" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{p.invoiceNo}</td>
                <td className="px-4 py-3">{p.user?.name}</td>
                <td className="px-4 py-3">{p.purchase?.package?.name}</td>
                <td className="px-4 py-3">
                  {p.currency} {p.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">{p.kind}</td>
                <td className="px-4 py-3">
                  <Badge color={color[p.status]}>{p.status}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No payments yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
