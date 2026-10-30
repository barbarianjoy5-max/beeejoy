"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  FileArchive,
  ArrowRight,
  PackageCheck,
  CreditCard,
  Store,
} from "lucide-react";
import { insforge } from "../lib/insforge";
import { Product, PublicVendor } from "../lib/types";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "free" | "premium">("all");

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data: prodsData, error: pErr } = await insforge.database
          .from("products")
          .select("*")
          .eq("status", "published")
          .order("created_at", { ascending: false });

        if (!pErr && prodsData) {
          // Fetch public vendors to enrich cards with seller attribution
          const { data: vendorsData } = await insforge.database
            .from("public_vendors")
            .select("id, store_name, slug, bio, cover_url, created_at");

          const vendorMap = new Map((vendorsData || []).map((v: any) => [v.id, v as PublicVendor]));

          const enriched = prodsData.map((p: any) => ({
            ...p,
            vendor: p.vendor_id ? vendorMap.get(p.vendor_id) || null : null,
          }));

          setProducts(enriched as Product[]);
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadProducts();
  }, []);

  const filteredProducts = products.filter((p) => {
    if (filter === "free") return p.product_type === "free";
    if (filter === "premium") return p.product_type === "premium";
    return true;
  });

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden px-6 py-20 sm:py-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_50%_at_50%_40%,rgba(245,158,11,0.12),rgba(9,9,11,0))] pointer-events-none" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Official BEEEJOY Software Catalog & Creator Marketplace</span>
          </div>

          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
            Fast, Reliable Software Downloads by <span className="text-amber-400">BEEEJOY</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg leading-8 text-zinc-400 max-w-2xl mx-auto">
            Download verified free software directly with one click, or contact product sellers to purchase premium creator tools with manual bKash & Nagad support.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#products"
              className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400 transition-all flex items-center gap-2"
            >
              <PackageCheck className="h-4 w-4" />
              <span>Browse Catalog</span>
            </a>
            <a
              href="#payments"
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              <span>Payment Info (bKash / Nagad)</span>
            </a>
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <section id="products" className="w-full max-w-7xl px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Software Releases</span>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-white">Available Software</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Direct ZIP downloads for Free tools &bull; Instant WhatsApp order for Premium software.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1 self-start sm:self-auto">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filter === "all"
                  ? "bg-amber-500 text-zinc-950 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setFilter("free")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filter === "free"
                  ? "bg-amber-500 text-zinc-950 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Free ({products.filter((p) => p.product_type === "free").length})
            </button>
            <button
              onClick={() => setFilter("premium")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filter === "premium"
                  ? "bg-amber-500 text-zinc-950 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Premium ({products.filter((p) => p.product_type === "premium").length})
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 animate-pulse flex flex-col justify-between h-96"
              >
                <div>
                  <div className="h-44 w-full rounded-xl bg-zinc-800 mb-4" />
                  <div className="h-5 w-3/4 bg-zinc-800 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-zinc-800/60 rounded" />
                </div>
                <div className="h-10 w-full bg-zinc-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <FileArchive className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No software products found</h3>
            <p className="mt-1 text-xs text-zinc-400">
              {filter !== "all"
                ? `There are currently no published ${filter} products.`
                : "The admin has not published any software products yet. Please check back soon!"}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const isFree = product.product_type === "free";
              const priceBDT = product.price_cents ? (product.price_cents / 100).toLocaleString("en-BD") : "0";
              const cleanWhatsApp = product.metadata?.whatsapp_number
                ? String(product.metadata.whatsapp_number).replace(/[\s\+\-\(\)]/g, "").trim()
                : null;
              const hasValidWhatsApp = Boolean(cleanWhatsApp && /^[0-9]{7,15}$/.test(cleanWhatsApp));

              return (
                <div
                  key={product.id}
                  className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all overflow-hidden"
                >
                  <div>
                    {/* Thumbnail Image */}
                    <Link href={`/products/${product.slug}`} className="block relative aspect-video w-full bg-zinc-950 overflow-hidden border-b border-zinc-800/60">
                      {product.thumbnail_url ? (
                        <img
                          src={product.thumbnail_url}
                          alt={product.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
                          <FileArchive className="h-12 w-12 text-zinc-700" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        {isFree ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 backdrop-blur-md">
                            FREE
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-md">
                            PREMIUM
                          </span>
                        )}
                      </div>
                    </Link>

                    {/* Card Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                        <Link href={`/products/${product.slug}`}>{product.title}</Link>
                      </h3>

                      {/* Seller Name Attribution */}
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-400">
                        <span>By</span>
                        {product.vendor ? (
                          <Link
                            href={`/seller/${product.vendor.slug}`}
                            className="inline-flex items-center gap-1 font-semibold text-amber-400 hover:text-amber-300 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Store className="h-3 w-3" />
                            <span>{product.vendor.store_name}</span>
                          </Link>
                        ) : (
                          <span className="font-semibold text-zinc-400">BEEEJOY Official</span>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                        {product.description || "No description provided."}
                      </p>

                      <div className="mt-5 flex items-baseline gap-1">
                        {isFree ? (
                          <span className="text-2xl font-black text-emerald-400">Free</span>
                        ) : (
                          <>
                            <span className="text-2xl font-black text-amber-400">৳ {priceBDT}</span>
                            <span className="text-xs text-zinc-500">BDT</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="border-t border-zinc-800/80 p-6 pt-4 bg-zinc-950/20">
                    {isFree ? (
                      <div className="space-y-2">
                        <a
                          href={`/api/download/${product.slug}`}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-zinc-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/15 transition-all text-center"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Direct ZIP Download</span>
                        </a>
                        <Link
                          href={`/products/${product.slug}`}
                          className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors"
                        >
                          <span>View Product Details</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {hasValidWhatsApp ? (
                          <a
                            href={`https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(
                              `Hello, I would like to order "${product.title}" (Price: ৳${priceBDT} BDT) from BEEEJOY.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all text-center"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Order via WhatsApp</span>
                          </a>
                        ) : (
                          <Link
                            href={`/products/${product.slug}`}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all text-center"
                          >
                            <span>View Details & Order</span>
                          </Link>
                        )}
                        <Link
                          href={`/products/${product.slug}`}
                          className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors"
                        >
                          <span>Full Overview & Video Demo</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Manual Payment Information Section */}
      <section id="payments" className="w-full max-w-7xl px-6 py-16 border-t border-zinc-900">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-4">
            <CreditCard className="h-3.5 w-3.5" />
            <span>Payment Methods</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Manual bKash & Nagad Payments</h2>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            For premium software, click <span className="text-amber-400 font-semibold">Order via WhatsApp</span> on any product.
            You will be connected directly to the product seller who will share personal bKash/Nagad details and provide instant license delivery.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20 mb-4">
              <span className="font-bold text-lg">bK</span>
            </div>
            <h3 className="text-base font-bold text-white">bKash Personal</h3>
            <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
              Send money directly via bKash personal wallet. Transaction verified on WhatsApp.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20 mb-4">
              <span className="font-bold text-lg">N</span>
            </div>
            <h3 className="text-base font-bold text-white">Nagad Personal</h3>
            <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
              Fast money transfer via Nagad. Instant confirmation through direct chat.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">Instant Delivery</h3>
            <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
              After confirming your transaction ID, your download package and license key will be delivered immediately.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
