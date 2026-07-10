"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, homeForRole } from "@/lib/auth";
import { Button, Card, ErrorText, Input } from "@/components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);
      router.replace(homeForRole(user.role));
    } catch (err: any) {
      setError(err.message || "Login failed");
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
        <h1 className="mb-1 text-2xl font-bold text-brand">Welcome back</h1>
        <p className="mb-6 text-sm text-slate-500">
          Sign in to your consultation account
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <ErrorText message={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          <Link href="/forgot-password" className="text-brand">
            Forgot password?
          </Link>
          <Link href="/register" className="text-brand">
            Create account
          </Link>
        </div>
        <p className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Demo: admin@example.com / consultant@example.com / client@example.com
          — password Password123!
        </p>
      </Card>
    </div>
  );
}
