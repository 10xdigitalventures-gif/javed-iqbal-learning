"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import clsx from "clsx";
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
  Settings,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";
import type { Role } from "@/lib/types";

const nav = {
  ADMIN: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/clients", label: "Clients", icon: Users },
    { href: "/admin/packages", label: "Packages", icon: Package },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/notifications", label: "Push Notifications", icon: Bell },
    { href: "/admin/communities", label: "Communities", icon: MessageSquare },
    { href: "/admin/ebooks", label: "E-Books", icon: BookOpen },
    { href: "/admin/courses", label: "Courses", icon: GraduationCap },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    { href: "/admin/media", label: "Media Library", icon: Images },
    { href: "/admin/settings", label: "Settings", icon: Settings },
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
  role: Role;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role !== role) router.replace("/");
  }, [loading, user, role, router]);

  if (loading || !user || user.role !== role) return <Spinner />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-slate-200 bg-white/95 px-4 py-5 shadow-sm backdrop-blur lg:flex">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-950">Consult Hub</p>
            <p className="text-xs text-slate-500">
              {role.toLowerCase()} portal
            </p>
          </div>
        </div>
        <nav
          className="flex-1 space-y-1 overflow-y-auto pb-16"
          aria-label="Main navigation"
        >
          {nav[role].map((item) => {
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
