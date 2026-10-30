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
  Store,
} from "lucide-react";
import { insforge } from "../../../lib/insforge";
import { Product, PublicVendor } from "../../../lib/types";
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
          // If product has a vendor_id, fetch vendor from public_vendors view
          if (data.vendor_id) {
            const { data: vData } = await insforge.database
              .from("public_vendors")
              .select("id, store_name, slug, bio, cover_url, created_at")
              .eq("id", data.vendor_id)
              .maybeSingle();

            if (vData) {
              data.vendor = vData as PublicVendor;
            }
          }
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

  // Construct message
  const whatsappMessage = encodeURIComponent(
    `Hello, I would like to order "${product.title}" (Price: ৳${priceBDT} BDT) from BEEEJOY.`
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
        <Link href="/" className="hover:text-amber-400 transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          <span>Software Catalog</span>
        </Link>
        <span>/</span>
        <span className="text-zinc-300 font-medium truncate max-w-xs">{product.title}</span>
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Main Content (2 cols) */}
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

            {/* Seller attribution link */}
            <div className="mt-2.5 flex items-center gap-2 text-xs text-zinc-400">
              <span>Sold by:</span>
              {product.vendor ? (
                <Link
                  href={`/seller/${product.vendor.slug}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-amber-400 hover:text-amber-300 hover:underline"
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>{product.vendor.store_name}</span>
                </Link>
              ) : (
                <span className="font-semibold text-zinc-300">BEEEJOY Official</span>
              )}
            </div>
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
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Verified Clean ZIP Package</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Compatible with Windows & macOS</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-300">
                <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Instant Delivery after Payment</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-300">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Full Setup & Installation Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Sidebar (1 col) */}
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

              {/* Seller attribution card */}
              {product.vendor && (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Store className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="truncate text-zinc-300 font-medium">{product.vendor.store_name}</span>
                  </div>
                  <Link
                    href={`/seller/${product.vendor.slug}`}
                    className="text-[11px] font-semibold text-amber-400 hover:underline shrink-0 ml-2"
                  >
                    View Store
                  </Link>
                </div>
              )}

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
                    Click to chat directly on WhatsApp ({cleanWhatsApp}) with pre-filled product details.
                  </p>
                </div>
              ) : (
                /* Unconfigured WhatsApp notice */
                <div className="space-y-3">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>Contact details are currently being updated for this product. Please check back shortly.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Payment Information Card (bKash & Nagad) for Premium products */}
            {!isFree && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-xs space-y-4">
                <div className="flex items-center gap-2 text-white font-bold">
                  <CreditCard className="h-4 w-4 text-amber-400" />
                  <span>Manual Payment Instructions</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  To complete your order, send{" "}
                  <strong className="text-white">৳ {priceBDT} BDT</strong> via{" "}
                  <strong className="text-pink-400">bKash</strong> or{" "}
                  <strong className="text-orange-400">Nagad</strong> to the contact number provided on WhatsApp:
                </p>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-center text-amber-400 font-bold tracking-wider text-sm">
                  {cleanWhatsApp || "WhatsApp Contact"}
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  After sending the payment, share your Transaction ID (TrxID) in the WhatsApp chat. The software package and license key will be delivered instantly.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
