"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { api } from "@/lib/api";

type Certificate = {
  id: string;
  serial: string;
  issuedAt: string;
  holderName: string;
  courseTitle: string;
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

export default function CertificatePage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [cert, setCert] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState("");

  useEffect(() => {
    api<Certificate>("/certificates/" + id)
      .then((c) => {
        setCert(c);
        if (typeof window !== "undefined") {
          setVerifyUrl(window.location.origin + "/verify/" + c.serial);
        } else {
          setVerifyUrl(c.verifyUrl);
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-slate-500">{error}</p>
      </main>
    );
  }

  if (!cert) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-slate-400">Loading certificate…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark"
        >
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      <div className="mx-auto max-w-3xl bg-white p-2 shadow-xl print:shadow-none">
        <div className="border-[6px] border-brand print:border-brand">
          <div className="border border-slate-200 px-10 py-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand">
              Certificate of Completion
            </p>
            <p className="mt-6 text-sm text-slate-500">
              This is proudly presented to
            </p>
            <h1 className="mt-2 text-4xl font-extrabold text-slate-950">
              {cert.holderName}
            </h1>
            <div className="mx-auto mt-3 h-1 w-24 rounded bg-brand" />
            <p className="mt-6 text-sm text-slate-500">
              for successfully completing the course
            </p>
            <h2 className="mt-1 text-2xl font-bold text-brand">
              {cert.courseTitle}
            </h2>

            <div className="mt-10 flex items-end justify-between">
              <div className="text-left">
                <p className="text-base font-bold text-slate-900">
                  Prof. Dr. Javed Iqbal
                </p>
                <p className="text-xs text-slate-400">Authorised signatory</p>
                <p className="mt-4 text-xs text-slate-400">
                  Issued {formatDate(cert.issuedAt)}
                </p>
              </div>
              <div className="text-center">
                <div className="rounded-lg border border-slate-100 p-2">
                  <QRCodeSVG
                    value={verifyUrl || cert.verifyUrl}
                    size={96}
                    fgColor="#0f172a"
                    level="M"
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  {cert.serial}
                </p>
                <p className="text-[10px] text-slate-400">Scan to verify</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
