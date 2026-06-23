"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, ErrorText, Input } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ token: string }>("/auth/register", {
        method: "POST",
        body: form,
      });
      setToken(res.token);
      await refresh();
      router.replace("/client");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-brand">Create account</h1>
        <p className="mb-6 text-sm text-slate-500">
          Register as a client to purchase consultations and mentorship
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Full name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
          />
          <ErrorText message={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating..." : "Create account"}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand">
            Already have an account? Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
