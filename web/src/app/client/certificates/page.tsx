"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Copy, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Spinner, Button, ErrorText } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Certificate = {
  id: string;
  serial: string;
  issuedAt: string;
  courseId: string;
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

export default function ClientCertificatesPage() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api<Certificate[]>("/certificates/mine")
      .then(setCerts)
      .catch((e) => setError(e.message));
  }, []);

  function shareLink(cert: Certificate) {
    const url =
      typeof window !== "undefined"
        ? window.location.origin + "/verify/" + cert.serial
        : cert.verifyUrl;
    navigator.clipboard?.writeText(url);
    setCopied(cert.id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <PageHeader
        title="My Certificates"
        subtitle="Certificates you have earned by completing courses"
      />

      {error ? <ErrorText message={error} /> : null}

      {!certs ? (
        <Spinner />
      ) : certs.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand">
              <Award className="h-7 w-7" />
            </div>
            <p className="font-semibold text-slate-800">No certificates yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Complete a course end-to-end and your certificate will appear here
              automatically.
            </p>
            <Link href="/client/courses" className="mt-4">
              <Button variant="outline">Browse courses</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {certs.map((cert) => (
            <Card key={cert.id}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
                  <Award className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-slate-950">
                    {cert.courseTitle}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Issued {formatDate(cert.issuedAt)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    {cert.serial}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={"/certificate/" + cert.id} className="flex-1">
                  <Button className="w-full">
                    <ExternalLink className="mr-1.5 h-4 w-4" /> View & print
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => shareLink(cert)}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  {copied === cert.id ? "Copied" : "Share link"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
