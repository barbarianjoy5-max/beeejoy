"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth-context";
import { insforge } from "../../../lib/insforge";
import { Key, Download, Cpu, Clock, ShieldCheck, Copy, Check, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";

interface LicenseItem {
  id: string;
  order_id: string;
  product_id: string;
  key_prefix: string;
  status: "active" | "suspended" | "revoked" | "expired";
  max_activations: number;
  current_activations: number;
  grace_period_days: number;
  expires_at: string | null;
  created_at: string;
  product?: {
    title: string;
    slug: string;
    product_type: string;
  };
}

export default function MyLicensesPage() {
  const { user, isLoading: authLoading, openAuthModal } = useAuth();
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fetchLicenses = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await insforge.database
        .from("licenses")
        .select(`
          id,
          order_id,
          product_id,
          key_prefix,
          status,
          max_activations,
          current_activations,
          grace_period_days,
          expires_at,
          created_at,
          products (
            title,
            slug,
            product_type
          )
        `)
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (data && !error) {
        setLicenses(
          data.map((l: any) => ({
            ...l,
            product: l.products,
          }))
        );
      }
    } catch (err) {
      console.warn("Could not load licenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, [user]);

  const handleCopy = (keyText: string, id: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownload = async (license: LicenseItem) => {
    setDownloadingId(license.id);
    setDownloadError(null);

    try {
      // Direct binary download for verified license holders
      const productSlug = license.product?.slug || "bejoy-system-active";
      
      // Simulate/trigger binary download package
      const mockDownloadUrl = `https://storage.beeejoy.com/packages/${productSlug}-latest.zxp`;
      
      // Trigger download
      const link = document.createElement("a");
      link.href = mockDownloadUrl;
      link.setAttribute("download", `${productSlug}.zxp`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setDownloadError(err?.message || "Failed to generate download link.");
    } finally {
      setTimeout(() => setDownloadingId(null), 1000);
    }
  };

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
          <Key className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">Sign In Required</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in to view your software licenses and download packages.
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Breadcrumb & Header */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
        <Link href="/account" className="hover:text-amber-400 transition-colors">
          Account
        </Link>
        <span>/</span>
        <span className="text-zinc-300">Licenses</span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">My Software Licenses</h1>
          <p className="mt-1 text-xs text-zinc-400">
            View license keys, activation limits (Option B), and download authenticated `.zxp` packages.
          </p>
        </div>
        <button
          onClick={fetchLicenses}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {downloadError && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{downloadError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex py-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : licenses.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400 mb-4">
            <Key className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">No active licenses yet</h3>
          <p className="mt-2 text-xs text-zinc-400 max-w-sm mx-auto">
            Once your bKash or Nagad payment is reviewed and verified by the admin team, your licenses will appear here automatically.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/#extensions"
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all"
            >
              Browse Catalog
            </Link>
            <Link
              href="/account/orders"
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-xs font-semibold text-zinc-200 hover:text-white transition-all"
            >
              Check Orders
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {licenses.map((license) => (
            <div
              key={license.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 hover:border-zinc-700 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                      {license.product?.product_type || "CEP Extension"}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        license.status === "active"
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border border-rose-500/30 bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {license.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xl font-bold text-white">
                    {license.product?.title || "BEEEJOY Software Product"}
                  </h3>
                </div>

                <button
                  onClick={() => handleDownload(license)}
                  disabled={downloadingId === license.id}
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all"
                >
                  {downloadingId === license.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>Download .ZXP Package</span>
                </button>
              </div>

              {/* License Details Grid */}
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                  <span className="text-[10px] text-zinc-500 block mb-1">License Key</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {license.key_prefix}-••••-••••
                    </span>
                    <button
                      onClick={() => handleCopy(`${license.key_prefix}-XXXX-XXXX-XXXX`, license.id)}
                      className="text-zinc-400 hover:text-white p-1 rounded"
                    >
                      {copiedKey === license.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                  <span className="text-[10px] text-zinc-500 block mb-1">Machine Activations</span>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      {license.current_activations} / {license.max_activations} Machines
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                  <span className="text-[10px] text-zinc-500 block mb-1">Offline Grace Period</span>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      {license.grace_period_days} Days Offline Allowed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
