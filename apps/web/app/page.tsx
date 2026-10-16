"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Download, Sparkles, Cpu, Layers, CreditCard, Clock } from "lucide-react";
import CheckoutModal, { CheckoutProduct } from "../components/CheckoutModal";

export default function HomePage() {
  const [selectedProduct, setSelectedProduct] = useState<CheckoutProduct | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const products = [
    {
      title: "BEJOY SYSTEM ACTIVE",
      slug: "bejoy-system-active",
      badge: "Flagship CEP Extension",
      category: "Adobe Illustrator CEP Extension",
      tagline: "High-performance tool orchestration and workflow accelerator for Illustrator.",
      price: "৳ 2,499",
      price_cents: 249900,
      features: [
        "Full Adobe Illustrator CEP integration",
        "Instant one-click tool orchestration & automation",
        "Up to 2 machine activations included",
        "7-day offline license grace period",
        "Free lifetime updates for v1.x",
      ],
      featured: true,
    },
    {
      title: "BEJOY BROWSER",
      slug: "bejoy-browser",
      badge: "In-App Browser",
      category: "Adobe Illustrator CEP Extension",
      tagline: "Seamless in-canvas asset, vector resource, and template browser inside Illustrator.",
      price: "৳ 1,999",
      price_cents: 199900,
      features: [
        "Embedded floating panel directly inside workspace",
        "Fast local & cloud asset search",
        "Drag-and-drop vector placement directly onto artboards",
        "Multi-machine licensing support",
        "Optimized for high-DPI displays",
      ],
      featured: false,
    },
    {
      title: "PARTNER SUITE ACCESS",
      slug: "partner-suite",
      badge: "Authorized Partner Software",
      category: "Multi-Vendor Marketplace",
      tagline: "Curated productivity tools and creative scripts from vetted third-party creators.",
      price: "৳ 999",
      price_cents: 99900,
      features: [
        "Verified developer software",
        "Strict code security inspection",
        "Direct verified download links",
        "Vendor support and transparent licensing",
      ],
      featured: false,
    },
  ];

  const handleBuy = (p: typeof products[0]) => {
    setSelectedProduct({
      title: p.title,
      slug: p.slug,
      price: p.price,
      price_cents: p.price_cents,
      category: p.category,
    });
    setIsCheckoutOpen(true);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Checkout Modal */}
      <CheckoutModal
        product={selectedProduct}
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />

      {/* Hero Section */}
      <section className="relative w-full overflow-hidden px-6 py-24 sm:py-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_50%_at_50%_40%,rgba(245,158,11,0.12),rgba(9,9,11,0))] pointer-events-none" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next-Gen Creator Tools & Adobe Illustrator Extensions</span>
          </div>

          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
            Supercharge Your Design Flow with <span className="text-amber-400">BEEEJOY</span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-zinc-400 max-w-2xl mx-auto">
            The premium software store for professional Adobe Illustrator CEP extensions, proprietary design accelerators, and authorized developer tools.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <a
              href="#extensions"
              className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400 transition-all"
            >
              Explore Products
            </a>
            <a
              href="#payments"
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all"
            >
              Payment Methods (bKash / Nagad)
            </a>
          </div>
        </div>
      </section>

      {/* Flagship Extensions Section */}
      <section id="extensions" className="w-full max-w-7xl px-6 py-16">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Software Catalog</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">Featured Adobe CEP Extensions</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Engineered specifically for Adobe Illustrator with verified server-side licensing and offline grace protection.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.slug}
              id={product.slug === "partner-suite" ? "partner-software" : undefined}
              className={`flex flex-col justify-between rounded-2xl border p-8 transition-all ${
                product.featured
                  ? "border-amber-500/50 bg-gradient-to-b from-amber-950/20 to-zinc-950/90 shadow-xl shadow-amber-500/5"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                    {product.badge}
                  </span>
                  <span className="text-xs font-medium text-zinc-500">{product.category}</span>
                </div>

                <h3 className="mt-4 text-2xl font-bold text-white">
                  <Link href={`/products/${product.slug}`} className="hover:text-amber-400 transition-colors">
                    {product.title}
                  </Link>
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">{product.tagline}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-amber-400">{product.price}</span>
                  <span className="text-xs text-zinc-500">/ license</span>
                </div>

                <div className="my-6 h-px bg-zinc-800" />

                <ul className="space-y-3 text-xs text-zinc-300">
                  {product.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4 flex flex-col gap-2">
                <button
                  onClick={() => handleBuy(product)}
                  className={`w-full rounded-xl py-3 text-xs font-bold transition-all ${
                    product.featured
                      ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20"
                      : "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-500/40 hover:text-white"
                  }`}
                >
                  Buy License
                </button>
                <Link
                  href={`/products/${product.slug}`}
                  className="text-center text-[11px] font-medium text-zinc-500 hover:text-amber-400 py-1 transition-colors"
                >
                  View specs & compatibility →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security & Licensing Architecture Highlights */}
      <section id="licensing" className="w-full border-y border-zinc-900 bg-zinc-900/20 py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Architecture</span>
            <h2 className="mt-2 text-3xl font-bold text-white">Security & Licensing Built for Creators</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Zero compromises on file security, licensing reliability, or user convenience.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
              <ShieldCheck className="h-8 w-8 text-amber-400 mb-4" />
              <h3 className="text-base font-bold text-white">Server-Validated (Option B)</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Machine fingerprinting enforces activation limits securely in the cloud without invasive client software.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
              <Clock className="h-8 w-8 text-amber-400 mb-4" />
              <h3 className="text-base font-bold text-white">7-Day Offline Grace</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Temporary network drops won&apos;t halt your work. Validated tokens remain active locally for 7 days offline.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
              <Download className="h-8 w-8 text-amber-400 mb-4" />
              <h3 className="text-base font-bold text-white">Private Signed Downloads</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Binary `.zxp` extension packages are strictly private and accessible only via short-lived authenticated S3 URLs.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
              <CreditCard className="h-8 w-8 text-amber-400 mb-4" />
              <h3 className="text-base font-bold text-white">Verified Manual Payments</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Supports bKash and Nagad with transaction references. Licenses are minted strictly after admin verification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Manual Payment Information Section */}
      <section id="payments" className="w-full max-w-7xl px-6 py-20">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 sm:p-12">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Payment Process</span>
            <h2 className="mt-2 text-3xl font-bold text-white">How Manual Verification Works</h2>
            <p className="mt-3 text-sm text-zinc-400">
              For Bangladesh customers and international orders prior to automated gateway activation:
            </p>

            <div className="mt-8 space-y-6">
              <div className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-sm font-bold text-amber-400 border border-amber-500/20">
                  1
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-white">Select Product & Order</h4>
                  <p className="mt-1 text-xs text-zinc-400">
                    Place an order for BEJOY SYSTEM ACTIVE or BEJOY BROWSER to receive a unique Order Number.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-sm font-bold text-amber-400 border border-amber-500/20">
                  2
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-white">Send Payment via bKash / Nagad / Bank</h4>
                  <p className="mt-1 text-xs text-zinc-400">
                    Send Money to our official verified accounts and note your Transaction ID (TrxID) or deposit receipt.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-sm font-bold text-amber-400 border border-amber-500/20">
                  3
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-white">Admin Verification & Instant License Issuance</h4>
                  <p className="mt-1 text-xs text-zinc-400">
                    Our team reviews the submission. Once verified, your license key is generated in your dashboard and signed download links become active immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
