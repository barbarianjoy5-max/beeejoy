"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, getClientAccessToken } from "@/lib/auth-context";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

function SuccessInner() {
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, openAuthModal } = useAuth();
  const [state, setState] = useState<"verifying" | "pending_review" | "pending" | "failed" | "error" | "done">("verifying");
  const [message, setMessage] = useState("");

  // Tolerant extraction: the gateway may append `invoice_id` with either `?`
  // or `&`, and may produce a malformed query like `?ref=X?invoice_id=Y`.
  // Both values are untrusted hints only — the authenticated POST to the
  // verify route remains the sole proof of payment.
  const extractParam = (key: string): string => {
    const fromRouter = searchParams.get(key);
    if (fromRouter) return fromRouter;
    if (typeof window === "undefined") return "";
    const m = window.location.search.match(new RegExp(`[?&]${key}=([A-Za-z0-9_-]+)`));
    return m ? m[1] : "";
  };

  const invoiceId = extractParam("invoice_id");
  const ref = extractParam("ref");

  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // wait for auth; user must sign in to verify

    if (!invoiceId || !ref) {
      setState("error");
      setMessage("Missing or malformed payment parameters. If you completed a payment, please contact support with your reference.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getClientAccessToken();
        const res = await fetch("/api/payments/uddoktapay/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ invoice_id: invoiceId, ref }),
        });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setState("error");
          setMessage(data?.error || "Verification failed. Please try again later.");
          return;
        }

        if (data.status === "paid_pending_review" || data.status === "approved" || data.status === "rejected") {
          setState("pending_review");
          setMessage(
            data.status === "paid_pending_review"
              ? "Payment verified successfully. Your membership is now awaiting admin approval."
              : `Payment status: ${data.status}.`
          );
        } else if (data.status === "pending") {
          setState("pending");
          setMessage("Payment is still pending at the gateway. Please check back shortly.");
        } else {
          setState("failed");
          setMessage("Payment could not be verified. If money was deducted, please contact support with your reference.");
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Verification request failed. Please try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, invoiceId, ref]);

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      {authLoading || (user && state === "verifying") ? (
        <Loader2 className="h-10 w-10 animate-spin text-amber-400 mx-auto" />
      ) : !user ? (
        <div className="space-y-4">
          <Clock className="h-12 w-12 text-amber-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Sign in to verify your payment</h1>
          <p className="text-xs text-zinc-400">
            Your payment was received by the gateway. Sign in with the account used for checkout to confirm it.
          </p>
          <button
            onClick={() => openAuthModal("signin")}
            className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400"
          >
            Sign In
          </button>
        </div>
      ) : state === "pending_review" ? (
        <div className="space-y-4">
          <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto" />
          <h1 className="text-2xl font-black text-white">Payment Verified</h1>
          <p className="text-sm text-zinc-400">{message}</p>
          <Link href="/seller/dashboard" className="inline-block rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400">
            Go to Seller Dashboard
          </Link>
        </div>
      ) : state === "pending" ? (
        <div className="space-y-4">
          <Clock className="h-14 w-14 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-black text-white">Payment Pending</h1>
          <p className="text-sm text-zinc-400">{message}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <XCircle className="h-14 w-14 text-rose-400 mx-auto" />
          <h1 className="text-2xl font-black text-white">Verification Issue</h1>
          <p className="text-sm text-zinc-400">{message}</p>
          <Link href="/seller/dashboard" className="inline-block rounded-xl border border-zinc-700 px-6 py-2.5 text-xs font-semibold text-zinc-200 hover:text-white">
            Back to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MembershipPaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-6 py-24 flex justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
