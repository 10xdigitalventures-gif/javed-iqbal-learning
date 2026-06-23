"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function PaymentSuccess() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CheckCircle className="mx-auto mb-3 text-green-600" size={48} />
        <h1 className="text-2xl font-bold">Payment successful</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your package is now active. You can start messaging and booking
          sessions.
        </p>
        <Link href="/client">
          <Button className="mt-4">Go to dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
