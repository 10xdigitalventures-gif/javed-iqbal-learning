"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Card, ErrorText, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setInfo("If the email exists, a reset code has been sent.");
      setStep("reset");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { email, code, password },
      });
      setInfo("Password reset. You can now sign in.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-dark.png"
          alt="Dr. Javed Iqbal"
          className="mb-5 h-10 w-auto"
        />
        <h1 className="mb-1 text-2xl font-bold text-brand">Reset password</h1>
        <p className="mb-6 text-sm text-slate-500">
          {step === "request"
            ? "Enter your email to receive a reset code"
            : "Enter the code and your new password"}
        </p>
        {step === "request" ? (
          <form onSubmit={request} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <ErrorText message={error} />
            {info ? <p className="text-sm text-green-700">{info}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              Send reset code
            </Button>
          </form>
        ) : (
          <form onSubmit={reset} className="space-y-4">
            <Input
              label="Reset code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <ErrorText message={error} />
            {info ? <p className="text-sm text-green-700">{info}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              Reset password
            </Button>
          </form>
        )}
        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand">
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
