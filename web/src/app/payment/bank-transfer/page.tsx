"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, uploadFile } from "@/lib/api";
import { Card, Spinner, Button, ErrorText } from "@/components/ui";
import {
  Landmark,
  Copy,
  CheckCircle,
  UploadCloud,
  ShieldCheck,
} from "lucide-react";

// Manual bank-transfer instructions + proof submission. The bank_transfer
// "gateway" redirects buyers here with ?ref=<paymentId>. They transfer the
// amount offline, then submit a receipt / transaction id. The payment stays
// PENDING until an admin verifies it.
type BankDetails = {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  instructions?: string;
};

export default function BankTransferPage() {
  const search = useSearchParams();
  const ref = search.get("ref") || "";

  const [details, setDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [senderName, setSenderName] = useState("");
  const [senderRef, setSenderRef] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api<BankDetails>("/payments/bank-details")
      .then(setDetails)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function copy(text: string, field: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(field);
          setTimeout(() => setCopied(null), 1500);
        })
        .catch(() => {});
    }
  }

  async function submit() {
    if (!ref) {
      setError("Missing payment reference. Please restart checkout.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let proofKey: string | undefined;
      if (file) {
        const up = await uploadFile(file);
        proofKey = up.key;
      }
      await api(`/payments/${ref}/bank-transfer`, {
        method: "POST",
        body: {
          proofKey,
          senderName: senderName.trim() || undefined,
          senderRef: senderRef.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  if (done) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <Card className="text-center">
          <CheckCircle className="mx-auto mb-3 text-green-600" size={48} />
          <h1 className="text-2xl font-bold text-slate-950">Proof submitted</h1>
          <p className="mt-2 text-sm text-slate-500">
            Thanks! We&apos;ve received your transfer details. Your purchase will
            be activated once our team verifies the payment \u2014 you&apos;ll get a
            notification.
          </p>
          <Link href="/client">
            <Button className="mt-4">Go to dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const rows: { label: string; value: string }[] = details
    ? [
        { label: "Bank", value: details.bankName },
        { label: "Account title", value: details.accountTitle },
        { label: "Account number", value: details.accountNumber },
        { label: "IBAN", value: details.iban },
      ]
    : [];

  return (
    <div className="mx-auto max-w-lg p-4">
      <Card>
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-brand" />
          <h1 className="text-xl font-bold text-slate-950">Bank transfer</h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Transfer the amount to the account below, then submit your proof so we
          can verify and activate your purchase.
        </p>

        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="text-xs text-slate-400">{r.label}</p>
                <p className="truncate text-sm font-medium text-slate-900">
                  {r.value}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(r.value, r.label)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                {copied === r.label ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-600" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        {details?.instructions ? (
          <p className="mt-3 whitespace-pre-wrap text-xs text-slate-500">
            {details.instructions}
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            Submit your proof
          </p>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
            <UploadCloud className="h-4 w-4" />
            <span className="truncate">
              {file ? file.name : "Upload receipt screenshot (optional)"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Sender account name"
            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand focus:outline-none"
          />
          <input
            value={senderRef}
            onChange={(e) => setSenderRef(e.target.value)}
            placeholder="Transaction ID / reference number"
            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand focus:outline-none"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note (optional, e.g. paid from JazzCash)"
            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand focus:outline-none"
          />

          <ErrorText message={error} />

          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "Submitting\u2026" : "Submit transfer proof"}
          </Button>

          <p className="flex items-center justify-center gap-1 text-xs text-slate-400">
            <ShieldCheck className="h-3 w-3" /> Verified manually by our team
          </p>
        </div>
      </Card>
    </div>
  );
}
