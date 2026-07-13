"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";
import { useBranding } from "@/lib/branding";

export default function StartPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const branding = useBranding();
  const brand = branding?.brandName || "10X Digital Ventures";

  useEffect(() => {
    if (loading) return;
    if (user) {
      // Already signed in — go straight to the consultation browsing page.
      // Clients browse consultants and packages at /client/consultants.
      // Admins and consultants land on their own dashboard.
      const dest =
        user.role === "CLIENT"
          ? "/client/consultants"
          : user.role === "CONSULTANT"
            ? "/consultant"
            : "/admin";
      router.replace(dest);
    } else {
      // Not signed in — send to register with a post-login redirect.
      router.replace("/register?redirect=/client/consultants");
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-8">
      <Spinner />
      <p className="text-sm text-slate-500">
        Setting up your {brand} consultation&hellip;
      </p>
    </div>
  );
}
