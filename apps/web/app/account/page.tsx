"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { insforge } from "../../lib/insforge";
import Link from "next/link";
import { Key, ShoppingBag, ShieldCheck, User, Calendar, Mail, ArrowRight, Loader2 } from "lucide-react";

export default function AccountPage() {
  const { user, profile, isLoading: authLoading, openAuthModal } = useAuth();
  const [stats, setStats] = useState<{ licensesCount: number; ordersCount: number }>({
    licensesCount: 0,
    ordersCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function loadStats() {
      try {
        setLoadingStats(true);
        const [licensesRes, ordersRes] = await Promise.all([
          insforge.database.from("licenses").select("id", { count: "exact" }).eq("customer_id", user?.id),
          insforge.database.from("orders").select("id", { count: "exact" }).eq("customer_id", user?.id),
        ]);

        setStats({
          licensesCount: licensesRes.count ?? (licensesRes.data?.length || 0),
          ordersCount: ordersRes.count ?? (ordersRes.data?.length || 0),
        });
      } catch (err) {
        console.warn("Could not load account stats:", err);
      } finally {
        setLoadingStats(false);
      }
    }

    loadStats();
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
          <User className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">Sign In to Your Account</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in or register to view your licenses, download files, and track your orders.
        </p>
        <button
          onClick={() => openAuthModal("signin")}
          className="mt-6 rounded-xl bg-amber-500 px-6 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all"
        >
          Sign In Now
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Account Dashboard</span>
          <h1 className="mt-1 text-3xl font-extrabold text-white">
            Welcome, {profile?.full_name || user.email?.split("@")[0]}
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Manage your Adobe Illustrator extension licenses, machine activations, and order records.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-right">
          <span className="text-[10px] text-zinc-500 block uppercase font-medium">Role</span>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
            {profile?.role || "Customer"}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Link
          href="/account/licenses"
          className="group flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-amber-500/40 hover:bg-zinc-900/60 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-white">
                {loadingStats ? "..." : stats.licensesCount}
              </span>
              <p className="text-xs font-semibold text-zinc-300">Active Licenses</p>
              <p className="text-[11px] text-zinc-500">View license keys & offline grace</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-amber-400 transition-colors" />
        </Link>

        <Link
          href="/account/orders"
          className="group flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-amber-500/40 hover:bg-zinc-900/60 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-white">
                {loadingStats ? "..." : stats.ordersCount}
              </span>
              <p className="text-xs font-semibold text-zinc-300">Order History</p>
              <p className="text-[11px] text-zinc-500">bKash / Nagad verification status</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-amber-400 transition-colors" />
        </Link>
      </div>

      {/* Account Info Card */}
      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h3 className="text-sm font-bold text-white mb-4">Profile Information</h3>
        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
            <Mail className="h-4 w-4 text-zinc-400" />
            <div>
              <span className="text-[10px] text-zinc-500 block">Email Address</span>
              <span className="font-medium text-white">{user.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <div>
              <span className="text-[10px] text-zinc-500 block">Member Since</span>
              <span className="font-medium text-white">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Active Member"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
