"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Download,
  ArrowLeft,
  FileArchive,
  MessageCircle,
  Video,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { insforge } from "../../../lib/insforge";
import { Product } from "../../../lib/types";
import { getYouTubeEmbedUrl } from "../../../lib/youtube";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function ProductDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      try {
        const { data, error } = await insforge.database
          .from("products")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (error || !data) {
          setNotFound(true);
        } else {
          setProduct(data as Product);
        }
      } catch (err) {
        console.error("Failed to load product:", err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadProduct();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="h-6 w-32 bg-zinc-800 rounded animate-pulse mb-8" />
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6 animate-pulse">
            <div className="aspect-video w-full rounded-2xl bg-zinc-800" />
            <div className="h-8 w-3/4 bg-zinc-800 rounded" />
            <div className="h-24 w-full bg-zinc-800/60 rounded" />
          </div>
          <div className="h-72 rounded-2xl bg-zinc-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <FileArchive className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white">Product Not Found</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The software product you are looking for does not exist or has been unpublished.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Software Catalog</span>
        </Link>
      </div>
    );
  }

  const isFree = product.product_type === "free";
  const priceBDT = product.price_cents ? (product.price_cents / 100).toLocaleString("en-BD") : "0";
  const youtubeUrl = product.metadata?.youtube_url;
  const embedUrl = getYouTubeEmbedUrl(youtubeUrl);

  // Extract and validate product-specific WhatsApp number
  const rawWhatsApp = product.metadata?.whatsapp_number;
  const cleanWhatsApp = rawWhatsApp ? String(rawWhatsApp).replace(/[\s\+\-\(\)]/g, "").trim() : null;
  const hasValidWhatsApp = Boolean(cleanWhatsApp && /^[0-9]{7,15}$/.test(cleanWhatsApp));

  const whatsappMessage = encodeURIComponent(
    `Hi BEEEJOY, I would like to purchase ${product.title} (Price: ৳${priceBDT}). Please provide payment instructions and confirm delivery.`
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Back button */}
      <Link
        href="/#products"
        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Software Catalog</span>
      </Link>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Main Details (2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header & Badges */}
          <div>
            <div className="flex items-center gap-2">
              {isFree ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                  FREE DOWNLOAD
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                  PREMIUM SOFTWARE
                </span>
              )}
              <span className="text-xs text-zinc-500">Official Release</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-white">
              {product.title}
            </h1>
          </div>

          {/* Product Image */}
          {product.thumbnail_url && (
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
              <img
                src={product.thumbnail_url}
                alt={product.title}
                className="w-full h-auto object-cover max-h-[460px]"
              />
            </div>
          )}

          {/* Optional YouTube Video Embed (ONLY rendered if valid YouTube URL is present) */}
          {embedUrl && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-white font-bold text-lg mb-4">
                <Video className="h-5 w-5 text-red-500" />
                <span>Product Video Preview & Walkthrough</span>
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-zinc-800 shadow-xl">
                <iframe
                  src={embedUrl}
                  title={`${product.title} Video Preview`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            </div>
          )}

          {/* Product Overview / Description */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3">Product Description</h2>
            <div className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line">
              {product.description || "No description provided for this software product."}
            </div>
          </div>

          {/* Features / Highlights */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-4">Package Details</h2>
            <ul className="space-y-3 text-xs text-zinc-300">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>Direct ZIP archive software package file</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>Verified safe and malware-free by BEEEJOY Admin</span>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>Compatible with standard Windows & macOS installations</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Action & Purchase Sidebar (1 col) */}
        <div>
          <div className="sticky top-24 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-8 shadow-xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {isFree ? "Free Software" : "Premium License"}
              </span>

              <div className="mt-3 flex items-baseline gap-1">
                {isFree ? (
                  <span className="text-4xl font-black text-emerald-400">Free</span>
                ) : (
                  <>
                    <span className="text-4xl font-black text-amber-400">৳ {priceBDT}</span>
                    <span className="text-xs text-zinc-500">BDT</span>
                  </>
                )}
              </div>

              <div className="my-6 border-t border-zinc-800" />

              {/* Free Direct Download */}
              {isFree ? (
                <div className="space-y-4">
                  <a
                    href={`/api/download/${product.slug}`}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all text-center"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download ZIP File</span>
                  </a>
                  <p className="text-[11px] text-center text-zinc-400">
                    Instant 1-click download. No login or payment required.
                  </p>
                </div>
              ) : hasValidWhatsApp ? (
                /* Premium Purchase: Direct WhatsApp Chat with Product Seller */
                <div className="space-y-4">
                  <a
                    href={`https://wa.me/${cleanWhatsApp}?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 transition-all text-center"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Order via WhatsApp</span>
                  </a>
                  <p className="text-[11px] text-center text-zinc-400">
                    Contact the seller directly on WhatsApp for instant confirmation & file delivery.
                  </p>
                </div>
              ) : (
                /* Premium software where seller WhatsApp is not configured */
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-amber-400 font-semibold text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>WhatsApp Contact Not Set</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    The seller&apos;s WhatsApp number has not been configured for this product yet.
                  </p>
                </div>
              )}

              <div className="mt-6 space-y-3 text-[11px] text-zinc-400 border-t border-zinc-800 pt-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Admin verified original software package</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Fast manual response and support</span>
                </div>
              </div>
            </div>

            {/* Premium Payment Details Card */}
            {!isFree && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-xs">
                <div className="flex items-center gap-2 text-white font-bold mb-3">
                  <CreditCard className="h-4 w-4 text-amber-400" />
                  <span>Payment Instructions</span>
                </div>
                <p className="text-zinc-400 text-[11px] mb-4">
                  Send Money (Personal) to either of the following accounts:
                </p>

                <div className="space-y-2 mb-4">
                  <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-2.5">
                    <span className="text-[10px] text-pink-400 font-bold block">bKash (Send Money)</span>
                    <span className="text-white font-mono font-semibold">[Admin bKash Number]</span>
                  </div>
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-2.5">
                    <span className="text-[10px] text-orange-400 font-bold block">Nagad (Send Money)</span>
                    <span className="text-white font-mono font-semibold">[Admin Nagad Number]</span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  After payment, share your <span className="text-white font-semibold">TrxID</span> on WhatsApp at{" "}
                  {hasValidWhatsApp ? (
                    <span className="text-emerald-400 font-mono font-semibold">+{cleanWhatsApp}</span>
                  ) : (
                    <span className="text-zinc-500 italic">[Seller WhatsApp Not Configured]</span>
                  )}
                  . The seller will verify and provide the full ZIP software package immediately.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}