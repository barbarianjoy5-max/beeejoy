"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth-context";
import { insforge } from "../../../lib/insforge";
import { ShoppingBag, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface OrderItem {
  id: string;
  order_number: string;
  total_amount_cents: number;
  currency: string;
  payment_method: string;
  status: "pending_payment" | "under_review" | "completed" | "cancelled" | "refunded";
  notes: string | null;
  created_at: string;
  submission?: {
    payment_channel: string;
    sender_identifier: string;
    transaction_ref: string;
    status: string;
  };
}

export default function MyOrdersPage() {
  const { user, isLoading: authLoading, openAuthModal } = useAuth();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await insforge.database
        .from("orders")
        .select(`
          id,
          order_number,
          total_amount_cents,
          currency,
          payment_method,
          status,
          notes,
          created_at,
          manual_payment_submissions (
            payment_channel,
            sender_identifier,
            transaction_ref,
            status
          )
        `)
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (data && !error) {
        setOrders(
          data.map((o: any) => ({
            ...o,
            submission: o.manual_payment_submissions?.[0] || null,
          }))
        );
      }
    } catch (err) {
      console.warn("Could not load orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-6">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">Sign In Required</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in to view your orders and check verification status.
        </p>
        <button
          onClick={() => openAuthModal("signin")}
          className="mt-6 rounded-xl bg-amber-500 px-6 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all"
        >
          Sign In
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: OrderItem["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
            <CheckCircle2 className="h-3 w-3" />
            <span>Verified & Completed</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-400 uppercase">
            <XCircle className="h-3 w-3" />
            <span>Cancelled</span>
          </span>
        );
      case "under_review":
      case "pending_payment":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 uppercase">
            <Clock className="h-3 w-3" />
            <span>Under Review</span>
          </span>
        );
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Breadcrumb & Header */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
        <Link href="/account" className="hover:text-amber-400 transition-colors">
          Account
        </Link>
        <span>/</span>
        <span className="text-zinc-300">Orders</span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Order History</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Track bKash / Nagad verification status and review past license purchases.
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="flex py-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400 mb-4">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">No orders placed yet</h3>
          <p className="mt-2 text-xs text-zinc-400 max-w-sm mx-auto">
            Browse our Illustrator extensions and software products to place your first order.
          </p>
          <Link
            href="/#extensions"
            className="mt-6 inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-zinc-700 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-white">{order.order_number}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <span className="text-[11px] text-zinc-500 block mt-1">
                    Placed on {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-lg font-black text-amber-400">
                    ৳ {(order.total_amount_cents / 100).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-500 block capitalize">
                    {order.payment_method.replace("_manual", "")}
                  </span>
                </div>
              </div>

              {/* Payment submission details */}
              {order.submission && (
                <div className="mt-4 rounded-xl border border-zinc-800/60 bg-zinc-950/50 p-3.5 text-xs">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Channel</span>
                      <span className="font-semibold text-zinc-200 capitalize">
                        {order.submission.payment_channel}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Sender Mobile</span>
                      <span className="font-mono text-zinc-200">{order.submission.sender_identifier}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Transaction ID (TrxID)</span>
                      <span className="font-mono font-bold text-amber-400">
                        {order.submission.transaction_ref}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {order.status === "completed" && (
                <div className="mt-4 flex justify-end">
                  <Link
                    href="/account/licenses"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <span>View License Keys</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
