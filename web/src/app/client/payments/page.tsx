"use client";

import { useEffect, useState } from "react";
import { FileText, ReceiptText } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import {
  downloadInvoice,
  downloadReceipt,
  type DocBusiness,
  type DocPayment,
} from "@/lib/documents";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  kind: string;
  gateway?: string;
  reference?: string | null;
  invoiceNo?: string;
  createdAt: string;
  purchase?: { package?: { name: string } };
  order?: {
    book?: { title: string };
    bundle?: { title: string };
    plan?: { name: string };
    course?: { title: string };
  };
  hardCopy?: { book?: { title: string } };
};

const color: Record<string, any> = {
  PAID: "green",
  PENDING: "amber",
  FAILED: "red",
  REFUNDED: "slate",
};

// Resolve a human-readable line item across the different payment sources
// (consultation package, digital order, or hard-copy order).
function itemName(p: Payment): string {
  return (
    p.purchase?.package?.name ||
    p.order?.book?.title ||
    p.order?.bundle?.title ||
    p.order?.plan?.name ||
    p.order?.course?.title ||
    p.hardCopy?.book?.title ||
    (p.kind === "SUBSCRIPTION" ? "Subscription" : "Purchase")
  );
}

function toDoc(p: Payment): DocPayment {
  return {
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    kind: p.kind,
    gateway: p.gateway,
    reference: p.reference ?? null,
    invoiceNo: p.invoiceNo ?? null,
    createdAt: p.createdAt,
    itemName: itemName(p),
  };
}

export default function ClientPayments() {
  const { user } = useAuth();
  const [list, setList] = useState<Payment[] | null>(null);
  const [business, setBusiness] = useState<DocBusiness>({
    name: "Prof. Dr. Javed Iqbal Learning",
  });

  useEffect(() => {
    api<Payment[]>("/payments/mine")
      .then(setList)
      .catch(() => setList([]));
    // Public settings power the invoice/receipt letterhead.
    api<Record<string, string>>("/settings")
      .then((s) =>
        setBusiness({
          name: s.platformName || "Prof. Dr. Javed Iqbal Learning",
          supportEmail: s.supportEmail,
        }),
      )
      .catch(() => {});
  }, []);

  const customer = {
    name: user?.name,
    email: user?.email,
    phone: (user as any)?.phone,
  };

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Your payment history, invoices and receipts"
      />
      <div className="space-y-2">
        {list.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{itemName(p)}</p>
                <p className="text-xs text-slate-500">
                  {p.invoiceNo ? `${p.invoiceNo} \u00b7 ` : ""}
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">
                  {p.currency} {p.amount.toLocaleString()}
                </span>
                <Badge color={color[p.status]}>{p.status}</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <Button
                variant="outline"
                onClick={() => downloadInvoice(toDoc(p), business, customer)}
              >
                <FileText className="mr-1.5 h-4 w-4" /> Invoice
              </Button>
              <Button
                variant="outline"
                disabled={p.status !== "PAID"}
                title={
                  p.status !== "PAID"
                    ? "Receipt is available once the payment is completed"
                    : undefined
                }
                onClick={() => downloadReceipt(toDoc(p), business, customer)}
              >
                <ReceiptText className="mr-1.5 h-4 w-4" /> Receipt
              </Button>
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
