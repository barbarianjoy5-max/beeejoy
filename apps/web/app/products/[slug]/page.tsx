"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Download, Cpu, Clock, CreditCard, ArrowLeft } from "lucide-react";
import CheckoutModal, { CheckoutProduct } from "../../../components/CheckoutModal";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function ProductDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const productData: Record<
    string,
    {
      title: string;
      category: string;
      tagline: string;
      price: string;
      price_cents: number;
      description: string;
      badge: string;
      features: string[];
      specs: {
        hostApp: string;
        cepVersion: string;
        os: string;
        activations: string;
        offlineGrace: string;
      };
    }
  > = {
    "bejoy-system-active": {
      title: "BEJOY SYSTEM ACTIVE",
      category: "Adobe Illustrator CEP Extension",
      badge: "Flagship CEP Extension",
      tagline: "High-performance tool orchestration and workflow accelerator for Illustrator.",
      price: "৳ 2,499",
      price_cents: 249900,
      description:
        "BEJOY SYSTEM ACTIVE is an enterprise-grade CEP workflow accelerator developed specifically for high-volume vector illustrators, production designers, and agency artists. It integrates natively inside Adobe Illustrator to automate repetitive transformations, batch color harmonize, organize layers, and orchestrate script executions at lightning speed.",
      features: [
        "Full Adobe Illustrator CEP integration (Photoshop / Illustrator 2022-2026)",
        "Instant one-click tool orchestration & macro automation",
        "Up to 2 machine activations included with Option B verification",
        "7-day offline license grace period with tamper-proof token storage",
        "Free lifetime updates for v1.x series",
        "Automatic background update check and signed `.zxp` package verification",
      ],
      specs: {
        hostApp: "Adobe Illustrator 2022 - 2026 (v26.0+)",
        cepVersion: "CEP 11 / 12 Native HTML5 Engine",
        os: "macOS 12+ (Apple Silicon & Intel) / Windows 10 & 11 (64-bit)",
        activations: "2 Machines per license (Option B Server-Validated)",
        offlineGrace: "7 Days continuous offline operation",
      },
    },
    "bejoy-browser": {
      title: "BEJOY BROWSER",
      category: "Adobe Illustrator CEP Extension",
      badge: "In-App Browser",
      tagline: "Seamless in-canvas asset, vector resource, and template browser inside Illustrator.",
      price: "৳ 1,999",
      price_cents: 199900,
      description:
        "BEJOY BROWSER embeds a responsive, fast asset search and resource browser directly inside your Adobe Illustrator workspace. Drag and drop vector components, color palettes, and SVG templates directly onto your active artboard without ever switching between desktop windows or browser tabs.",
      features: [
        "Embedded floating or docked panel directly inside Illustrator workspace",
        "Fast local and cloud asset index search",
        "Direct drag-and-drop vector placement onto active artboards",
        "Multi-machine licensing support (up to 2 devices)",
        "Optimized for high-DPI and Apple Retina displays",
        "Secure automatic token renewal",
      ],
      specs: {
        hostApp: "Adobe Illustrator 2021 - 2026 (v25.0+)",
        cepVersion: "CEP 10 / 11 Native HTML5 Engine",
        os: "macOS 11+ / Windows 10 & 11 (64-bit)",
        activations: "2 Machines per license",
        offlineGrace: "7 Days continuous offline operation",
      },
    },
    "partner-suite": {
      title: "PARTNER SUITE ACCESS",
      category: "Multi-Vendor Marketplace",
      badge: "Authorized Partner Software",
      tagline: "Curated productivity tools and creative scripts from vetted third-party creators.",
      price: "৳ 999",
      price_cents: 99900,
      description:
        "The Partner Suite provides all-access entry to verified third-party developer extensions, ExtendScript workflows, and Illustrator automations curated and audited directly by the BEEEJOY engineering team.",
      features: [
        "Verified developer software with strict security audits",
        "Direct verified download links via short-lived signed S3 URLs",
        "Unified license management through your BEEEJOY dashboard",
        "Vendor support and transparent licensing",
      ],
      specs: {
        hostApp: "Adobe Illustrator / ExtendScript",
        cepVersion: "Varies by tool",
        os: "macOS & Windows",
        activations: "Per-tool standard 2 activations",
        offlineGrace: "7 Days offline validation",
      },
    },
  };

  const product = productData[slug] || {
    title: slug.replace(/-/g, " ").toUpperCase(),
    category: "Software Product",
    badge: "Official Software",
    tagline: "High quality professional software tool from BEEEJOY.",
    price: "৳ 1,999",
    price_cents: 199900,
    description: "Detailed product information and documentation for this software package.",
    features: ["Verified digital license", "Direct binary downloads", "Multi-machine support"],
    specs: {
      hostApp: "Adobe Illustrator",
      cepVersion: "CEP 11+",
      os: "macOS / Windows",
      activations: "2 Machines",
      offlineGrace: "7 Days",
    },
  };

  const checkoutProduct: CheckoutProduct = {
    title: product.title,
    slug: slug,
    price: product.price,
    price_cents: product.price_cents,
    category: product.category,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Checkout Modal */}
      <CheckoutModal
        product={checkoutProduct}
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />

      {/* Back button */}
      <Link
        href="/#extensions"
        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Storefront</span>
      </Link>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Main Details (2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                {product.badge}
              </span>
              <span className="text-xs text-zinc-500">{product.category}</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-white">
              {product.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{product.tagline}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3">Product Overview</h2>
            <p className="text-xs leading-relaxed text-zinc-300">{product.description}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-4">Included Capabilities & Features</h2>
            <ul className="space-y-3 text-xs text-zinc-300">
              {product.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-4">Technical Specifications</h2>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                <span className="text-[10px] text-zinc-500 block">Host Application</span>
                <span className="font-semibold text-white">{product.specs.hostApp}</span>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                <span className="text-[10px] text-zinc-500 block">CEP Engine</span>
                <span className="font-semibold text-white">{product.specs.cepVersion}</span>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                <span className="text-[10px] text-zinc-500 block">Operating System</span>
                <span className="font-semibold text-white">{product.specs.os}</span>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                <span className="text-[10px] text-zinc-500 block">Machine Quota</span>
                <span className="font-semibold text-white">{product.specs.activations}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing & Purchase Sidebar (1 col) */}
        <div>
          <div className="sticky top-24 rounded-2xl border border-amber-500/40 bg-zinc-900/80 p-6 sm:p-8 shadow-xl shadow-amber-500/5">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Official License
            </span>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-black text-amber-400">{product.price}</span>
              <span className="text-xs text-zinc-500">/ license</span>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              One-time payment. Up to 2 machines active simultaneously with 7-day offline grace period.
            </p>

            <div className="my-6 border-t border-zinc-800" />

            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full rounded-xl bg-amber-500 py-3.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-lg shadow-amber-500/25 transition-all text-center"
            >
              Buy License Now (bKash / Nagad)
            </button>

            <div className="mt-6 space-y-3 text-[11px] text-zinc-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Instant manual verification with TrxID</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                <span>7-Day offline token validation grace</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Signed `.zxp` extension installer package</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
