"use client";

import React, { useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, ROOT_DOMAIN } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import type { OnboardResult, SlugCheck } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function slugMessage(state: string) {
  if (state === "reserved") return "That subdomain is reserved.";
  if (state === "taken") return "That subdomain is already taken.";
  if (state === "too_short") return "Use at least 3 characters.";
  return "Not available.";
}

function Field(props: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
        {props.label}
        {props.required ? <span className="text-red-500">*</span> : null}
      </span>
      {props.children}
      {props.hint ? (
        <span className="mt-1 block text-xs text-slate-400">{props.hint}</span>
      ) : null}
    </label>
  );
}

export default function OnboardPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("#FF9100");
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState("");
  const [check, setCheck] = useState<SlugCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkSlug() {
    const value = slug || name;
    if (!value) return;
    setChecking(true);
    try {
      const r = await apiGet<SlugCheck>(
        "/tenant/slug-available?slug=" + encodeURIComponent(value),
      );
      setCheck(r);
    } catch {
      setCheck(null);
    } finally {
      setChecking(false);
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await apiPost<OnboardResult>("/tenant/onboard", {
        name,
        slug: slug || undefined,
        supportEmail: email || undefined,
        primaryColor: color || undefined,
        tagline: tagline || undefined,
        category: category || undefined,
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            You are all set 🎉
          </h1>
          <p className="mt-2 text-slate-600">
            Your workspace has been provisioned at:
          </p>
          <a
            href={result.subdomainUrl}
            className="mt-3 inline-block break-all font-semibold text-brand hover:underline"
          >
            {result.subdomainUrl}
          </a>
          <p className="mt-4 text-sm text-slate-500">
            {result.listed
              ? "Your profile is live in the marketplace."
              : "Your profile will appear in the marketplace once our team reviews it."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-slate-600 hover:underline"
          >
            ← Back to marketplace
          </Link>
        </div>
      </main>
    );
  }

  const slugState = check
    ? check.available
      ? "available"
      : check.reason
    : null;

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        Become an expert
      </h1>
      <p className="mt-1 text-slate-600">
        Launch your own branded platform on 10X in minutes.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Your / brand name" required>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="Dr. Jane Doe"
          />
        </Field>

        <Field label="Subdomain" hint="Your platform address">
          <div className="flex items-center gap-2">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={checkSlug}
              className={inputCls}
              placeholder="janedoe"
            />
            <span className="whitespace-nowrap text-sm text-slate-500">
              .{ROOT_DOMAIN}
            </span>
          </div>
          {checking ? (
            <p className="mt-1 text-xs text-slate-400">Checking…</p>
          ) : null}
          {slugState === "available" ? (
            <p className="mt-1 text-xs text-green-600">
              ✓ {check?.slug} is available
            </p>
          ) : null}
          {slugState && slugState !== "available" ? (
            <p className="mt-1 text-xs text-red-500">
              {slugMessage(slugState)}
            </p>
          ) : null}
        </Field>

        <Field
          label="Category"
          hint="Helps clients discover you in the marketplace"
        >
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a category (optional)</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tagline">
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={inputCls}
            placeholder="Helping founders scale with systems"
          />
        </Field>

        <Field label="Support email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Brand color">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-20 cursor-pointer rounded-lg border border-slate-200"
          />
        </Field>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !name}
          className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create my platform"}
        </button>
      </form>
    </main>
  );
}
