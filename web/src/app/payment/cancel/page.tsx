"use client";

import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function PaymentCancel() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <XCircle className="mx-auto mb-3 text-red-600" size={48} />
        <h1 className="text-2xl font-bold">Payment cancelled</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your payment was not completed. You can try again any time.
        </p>
        <Link href="/client/packages">
          <Button className="mt-4">Back to packages</Button>
        </Link>
      </Card>
    </div>
  );
}
