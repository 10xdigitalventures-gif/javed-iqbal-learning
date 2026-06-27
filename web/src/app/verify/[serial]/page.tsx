"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";

type VerifyResult =
  | { valid: false; serial: string }
  | {
      valid: true;
      serial: string;
      holderName: string;
      courseTitle: string;
      issuedAt: string;
      verifyUrl: string;
    };

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

export default function VerifyCertificatePage() {
  const params = useParams<{ serial: string }>();
  const serial = decodeURIComponent(
    Array.isArray(params.serial) ? params.serial[0] : params.serial,
  );
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setPageUrl(window.location.href);
    api<VerifyResult>("/certificates/verify/" + encodeURIComponent(serial))
      .then(setResult)
      .catch(() => setResult({ valid: false, serial }))
      .finally(() => setLoading(false));
  }, [serial]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="bg-black px-6 py-5 text-center">
          <p className="text-lg font-extrabold tracking-tight text-white">
            Prof. Dr. Javed Iqbal
          </p>
          <p className="text-sm text-brand">Certificate verification</p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400">Verifying…</div>
        ) : result && result.valid ? (
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 text-sm font-semibold text-green-700">
                <BadgeCheck className="h-4 w-4" /> Verified &amp; authentic
              </span>
              <p className="text-sm text-slate-500">This certifies that</p>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-950">
                {result.holderName}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                has successfully completed
              </p>
              <h2 className="mt-1 text-lg font-bold text-brand">
                {result.courseTitle}
              </h2>
            </div>

            <div className="mt-6 flex items-center justify-center">
              <div className="rounded-xl border border-slate-100 p-3">
                <QRCodeSVG
                  value={pageUrl || serial}
                  size={120}
                  fgColor="#0f172a"
                  level="M"
                />
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-slate-400">Issued on</dt>
                <dd className="font-semibold text-slate-800">
                  {formatDate(result.issuedAt)}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-slate-400">Serial</dt>
                <dd className="font-mono text-xs font-semibold text-slate-800">
                  {result.serial}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="p-10 text-center">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-700">
              <ShieldAlert className="h-4 w-4" /> Not found
            </span>
            <p className="text-slate-600">
              No certificate matches serial{" "}
              <span className="font-mono text-slate-900">{serial}</span>.
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Please double-check the code on the certificate.
            </p>
          </div>
        )}

        <div className="border-t border-slate-100 px-6 py-3 text-center text-xs text-slate-400">
          Prof. Dr. Javed Iqbal Learning · Official certificate registry
        </div>
      </div>
    </main>
  );
}
