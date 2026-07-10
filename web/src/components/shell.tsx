"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import clsx from "clsx";
import { useBranding, useModules } from "@/lib/branding";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  Compass,
  CreditCard,
  Crown,
  GraduationCap,
  Headphones,
  Images,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Trophy,
  TrendingUp,
  GitMerge,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";
import type { Role } from "@/lib/types";

// Maps a nav href to the feature module that must be enabled for it to show.
// Anything not listed here is always shown (dashboards, users, payments,
// messages, support, notifications, settings...).
const NAV_MODULE: Record<string, keyof ReturnType<typeof useModules>> = {
  "/admin/ebooks": "books",
  "/admin/bundles": "bundles",
  "/admin/courses": "courses",
  "/admin/communities": "community",
  "/consultant/communities": "community",
  "/client/library": "books",
  "/client/audiobooks": "audiobooks",
  "/client/courses": "courses",
  "/client/certificates": "certificates",
  "/client/achievements": "achievements",
  "/client/subscription": "subscription",
  "/client/consultants": "consultation",
  "/client/meetings": "meetings",
  "/client/packages": "packages",
  "/client/communities": "community",
};

const nav = {
  ADMIN: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/packages", label: "Packages", icon: Package },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/notifications", label: "Push Notifications", icon: Bell },
    { href: "/admin/communities", label: "Communities", icon: MessageSquare },
    { href: "/admin/ebooks", label: "E-Books", icon: BookOpen },
    { href: "/admin/bundles", label: "Bundles", icon: Package },
    { href: "/admin/courses", label: "Courses", icon: GraduationCap },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    { href: "/admin/attribution", label: "Attribution", icon: TrendingUp },
    { href: "/admin/reconciliation", label: "Reconciliation", icon: GitMerge },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    { href: "/admin/media", label: "Media Library", icon: Images },
    { href: "/admin/support", label: "Support", icon: Headphones },
    { href: "/admin/team", label: "Team & roles", icon: ShieldCheck },
    { href: "/admin/inbox", label: "My alerts", icon: Bell },
    {
      href: "/admin/tenant-features",
      label: "Tenant Features",
      icon: Settings,
    },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ],
  SUPPORT: [
    { href: "/admin/support", label: "Support", icon: Headphones },
    { href: "/admin/inbox", label: "My alerts", icon: Bell },
  ],
  CONSULTANT: [
    { href: "/consultant", label: "Dashboard", icon: LayoutDashboard },
    { href: "/consultant/clients", label: "Clients", icon: Users },
    { href: "/consultant/messages", label: "Messages", icon: MessageSquare },
    { href: "/consultant/meetings", label: "Meetings", icon: CalendarClock },
    {
      href: "/consultant/availability",
      label: "Availability",
      icon: CalendarClock,
    },
    { href: "/consultant/communities", label: "Communities", icon: Users },
    { href: "/consultant/support", label: "Support", icon: Headphones },
    { href: "/consultant/notifications", label: "Notifications", icon: Bell },
  ],
  CLIENT: [
    { href: "/client", label: "Dashboard", icon: LayoutDashboard },
    { href: "/client/consultants", label: "Consultants", icon: Users },
    { href: "/client/explore", label: "Explore", icon: Compass },
    { href: "/client/library", label: "My Library", icon: BookOpen },
    { href: "/client/audiobooks", label: "Audio Books", icon: Headphones },
    { href: "/client/courses", label: "Courses", icon: GraduationCap },
    { href: "/client/certificates", label: "Certificates", icon: Award },
    { href: "/client/achievements", label: "Achievements", icon: Trophy },
    { href: "/client/subscription", label: "Subscription", icon: Crown },
    { href: "/client/packages", label: "Packages", icon: Package },
    { href: "/client/messages", label: "Messages", icon: MessageSquare },
    { href: "/client/meetings", label: "Meetings", icon: CalendarClock },
    { href: "/client/payments", label: "Payments", icon: CreditCard },
    { href: "/client/communities", label: "Communities", icon: Users },
    { href: "/client/support", label: "Support", icon: Headphones },
    { href: "/client/notifications", label: "Notifications", icon: Bell },
  ],
} satisfies Record<
  Role,
  Array<{ href: string; label: string; icon: typeof LayoutDashboard }>
>;

export function Shell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: Role | Role[];
}) {
  const { user, loading, logout } = useAuth();
  const branding = useBranding();
  const modules = useModules();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = Array.isArray(role) ? role : [role];
  const allowedKey = allowed.join(",");

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!allowed.includes(user.role)) router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, allowedKey, router]);

  if (loading || !user || !allowed.includes(user.role)) return <Spinner />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-slate-200 bg-white/95 px-4 py-5 shadow-sm backdrop-blur lg:flex">
        <div className="mb-7 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              branding?.logoDarkUrl ||
              branding?.logoUrl ||
              "/brand/logo-dark.png"
            }
            alt={branding?.brandName || "Dr. Javed Iqbal"}
            className="h-9 w-auto"
          />
          <p className="mt-1 text-xs capitalize text-slate-500">
            {user.role.toLowerCase()} portal
          </p>
        </div>
        <nav
          className="flex-1 space-y-1 overflow-y-auto pb-16"
          aria-label="Main navigation"
        >
          {(nav[user.role] || [])
            .filter((item) => {
              const mod = NAV_MODULE[item.href];
              return !mod || modules[mod];
            })
            .map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
                    active
                      ? "bg-brand text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
        </nav>
        <button
          onClick={logout}
          className="absolute bottom-5 left-4 right-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </aside>
      <main className="px-4 py-6 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
