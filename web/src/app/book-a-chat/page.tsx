"use client";

import Link from "next/link";
import { useBranding } from "@/lib/branding";

const STEPS = [
  {
    num: "01",
    title: "Create your free account",
    body: "Register in under 60 seconds — no credit card required.",
  },
  {
    num: "02",
    title: "Choose a package",
    body: "Pick from text, audio, video, or live session packages that fit your budget.",
  },
  {
    num: "03",
    title: "Start your consultation",
    body: "Get direct access to expert guidance in a private, secure chat.",
  },
];

const CHANNELS = [
  {
    icon: "\u{1F4AC}",
    title: "Text consultation",
    desc: "Send up to the message limit; get thorough written responses at your pace.",
  },
  {
    icon: "\u{1F3A7}",
    title: "Audio consultation",
    desc: "Record and exchange voice messages — perfect for detailed discussions.",
  },
  {
    icon: "\u{1F4F9}",
    title: "Video consultation",
    desc: "Share video clips for visual explanations and richer communication.",
  },
  {
    icon: "\u{1F4C5}",
    title: "Live session",
    desc: "Schedule real-time sessions for focused, interactive expert guidance.",
  },
];

const FAQS = [
  {
    q: "How quickly will I get a response?",
    a: "Most consultations are replied to within 24–48 hours on working days.",
  },
  {
    q: "Is my conversation private?",
    a: "Yes. All chats are encrypted and visible only to you and the consultant.",
  },
  {
    q: "Can I ask questions on any topic?",
    a: "Absolutely. Our experts cover a wide range — pick the package that matches your need.",
  },
  {
    q: "What if I am not satisfied?",
    a: "Contact our support team and we will make it right.",
  },
];

export default function BookAChatPage() {
  const branding = useBranding();
  const brand = branding?.brandName || "10X Digital Ventures";

  return (
    <main className="min-h-screen bg-white">
      {/* nav */}
      <nav className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold text-brand">{brand}</span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/book-a-chat/start"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark transition"
            >
              Book a chat
            </Link>
          </div>
        </div>
      </nav>

      {/* hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-light via-white to-white py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="mb-3 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            Expert consultation
          </p>
          <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Get expert guidance,
            <br />
            <span className="text-brand">on your schedule.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-600">
            Book a private chat with {brand}&apos;s experts. Choose text, audio,
            video, or live sessions — and get answers that matter.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/book-a-chat/start"
              className="w-full rounded-2xl bg-brand px-8 py-4 text-base font-bold text-white shadow-lg hover:bg-brand-dark transition sm:w-auto"
            >
              Book a chat now
            </Link>
            <Link
              href="/login"
              className="w-full rounded-2xl border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-700 hover:bg-slate-50 transition sm:w-auto"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold text-slate-900">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.num} className="text-center">
                <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-lg font-extrabold text-brand">
                  {s.num}
                </span>
                <h3 className="mb-2 font-semibold text-slate-900">{s.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* channels */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900">
            Choose your format
          </h2>
          <p className="mb-12 text-center text-sm text-slate-500">
            Every consultation style is available — pick what works for you.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CHANNELS.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
              >
                <span className="mb-3 block text-3xl">{c.icon}</span>
                <h3 className="mb-1 font-semibold text-slate-900">{c.title}</h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold text-slate-900">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-slate-100">
            {FAQS.map((f) => (
              <div key={f.q} className="py-5">
                <p className="mb-1 font-semibold text-slate-900">{f.q}</p>
                <p className="text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* bottom CTA */}
      <section className="bg-brand py-14">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold text-white">
            Ready to get started?
          </h2>
          <p className="mb-6 text-brand-light">
            Join thousands of clients who trust {brand} for expert guidance.
          </p>
          <Link
            href="/book-a-chat/start"
            className="inline-block rounded-2xl bg-white px-8 py-4 text-base font-bold text-brand shadow-lg hover:bg-slate-50 transition"
          >
            Book a chat now
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-slate-100 py-6">
        <div className="mx-auto max-w-6xl px-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <span className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} {brand}. All rights reserved.
          </span>
          <div className="flex gap-4">
            <Link
              href="/privacy"
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Privacy policy
            </Link>
            <Link
              href="/login"
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
