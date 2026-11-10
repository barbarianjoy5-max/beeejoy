"use client";

import React from "react";
import Link from "next/link";
import { XCircle } from "lucide-react";

export default function MembershipPaymentCancelPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <XCircle className="h-14 w-14 text-zinc-500 mx-auto" />
      <h1 className="mt-4 text-2xl font-black text-white">Payment Cancelled</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Your membership payment was cancelled before completion. No charge was confirmed and no membership was activated.
      </p>
      <Link
        href="/seller/dashboard"
        className="mt-6 inline-block rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400"
      >
        Back to Seller Dashboard
      </Link>
    </div>
  );
}
