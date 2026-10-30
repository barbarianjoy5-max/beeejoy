"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Store,
  ArrowLeft,
  PackageCheck,
  Download,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Calendar,
  AlertCircle,
  Package,
} from "lucide-react";
import { insforge } from "../../../lib/insforge";
import { Product, PublicVendor } from "../../../lib/types";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default function PublicSellerProfilePage({ params }: PageProps) {
  const { username } = use(params);
  const [vendor, setVendor] = useState<PublicVendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadSellerProfile() {
      try {
        setIsLoading(true);
        // 1. Fetch vendor from safe public_vendors view
        const { data: vendorData, error: vErr } = await insforge.database
          .from("public_vendors")
          .select("id, store_name, slug, bio, cover_url, created_at")
          .eq("slug", username)
          .maybeSingle();

        if (vErr || !vendorData) {
          setNotFound(true);
          return;
        }

        setVendor(vendorData as PublicVendor);

        // 2. Fetch published products belonging to this seller
        const { data: prodsData, error: pErr } = await insforge.database
          .from("products")
          .select("*")
          .eq("vendor_id", vendorData.id)
          .eq("status", "published")
          .order("created_at", { ascending: false });

        if (!pErr && prodsData) {
          setProducts(prodsData as Product[]);
        }
      } catch (err) {
        console.error("Failed to load seller profile:", err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadSellerProfile();
  }, [username]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 animate-pulse">
        <div className="aspect-[4/1] w-full rounded-3xl bg-zinc-800/60 mb-8" />
        <div className="h-8 w-64 bg-zinc-800 rounded mb-4" />
        <div className="h-4 w-96 bg-zinc-800/60 rounded mb-8" />
        <div className="grid gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-zinc-800/40" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !vendor) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <Store className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white">Seller Not Found</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The seller profile <code className="text-amber-400">@{username}</code> does not exist or is not currently
          active.
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

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Software Catalog</span>
      </Link>

      {/* Hero Banner / Cover */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
        {vendor.cover_url ? (
          <div className="aspect-[4/1] sm:aspect-[5/1] w-full overflow-hidden">
            <img
              src={vendor.cover_url}
              alt={vendor.store_name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[4/1] sm:aspect-[6/1] w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-zinc-900/40 to-transparent" />
        )}

        {/* Profile Info Overlay */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-t border-zinc-800/80 bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-2xl font-black text-zinc-950 shadow-xl shadow-amber-500/20 shrink-0">
              {vendor.store_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{vendor.store_name}</h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                  Verified Seller
                </span>
              </div>
              <p className="font-mono text-xs text-amber-400/90 mt-0.5">@{vendor.slug}</p>
              {vendor.bio && <p className="mt-2 text-xs text-zinc-300 max-w-2xl leading-relaxed">{vendor.bio}</p>}
              <div className="flex items-center gap-4 text-[11px] text-zinc-500 mt-3">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Member since {new Date(vendor.created_at).toLocaleDateString()}</span>
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-zinc-400 font-semibold">
                  <Package className="h-3 w-3 text-amber-400" />
                  <span>{products.length} Published Products</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Published Products Section */}
      <section className="mt-12">
        <div className="border-b border-zinc-800/80 pb-4 mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Software Releases</span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
            Products by {vendor.store_name}
          </h2>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <Package className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No products available yet</h3>
            <p className="mt-1 text-xs text-zinc-400">
              This seller has not published any software products to the marketplace yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const isFree = product.product_type === "free";
              const priceBDT = product.price_cents ? (product.price_cents / 100).toLocaleString("en-BD") : "0";
              const cleanWhatsApp = product.metadata?.whatsapp_number
                ? String(product.metadata.whatsapp_number).replace(/[\s\+\-\(\)]/g, "").trim()
                : null;
              const hasValidWhatsApp = Boolean(cleanWhatsApp && /^[0-9]{7,15}$/.test(cleanWhatsApp));

              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-amber-500/50 hover:bg-zinc-900/80 transition-all duration-200"
                >
                  <div>
                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800/80 mb-4">
                      {product.thumbnail_url ? (
                        <img
                          src={product.thumbnail_url}
                          alt={product.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-700">
                          <PackageCheck className="h-12 w-12" />
                        </div>
                      )}
                      <div className="absolute top-2.5 left-2.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border shadow-sm ${
                            isFree
                              ? "border-emerald-500/30 bg-emerald-500/90 text-zinc-950"
                              : "border-amber-500/30 bg-amber-500/90 text-zinc-950"
                          }`}
                        >
                          {isFree ? "Free Download" : "Premium"}
                        </span>
                      </div>
                    </div>

                    <Link href={`/products/${product.slug}`}>
                      <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                        {product.title}
                      </h3>
                    </Link>

                    <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                      {product.description || "Fast, verified software release for creators."}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-zinc-800/80 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-[10px] text-zinc-500 block uppercase font-medium">Price</span>
                        <span className="text-sm font-extrabold text-white">
                          {isFree ? (
                            <span className="text-emerald-400">FREE</span>
                          ) : (
                            <span className="text-amber-400">৳{priceBDT} <span className="text-[10px] text-zinc-400">BDT</span></span>
                          )}
                        </span>
                      </div>
                      <Link
                        href={`/products/${product.slug}`}
                        className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                      >
                        <span>Details</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>

                    {isFree ? (
                      <a
                        href={`/api/download/${product.slug}`}
                        className="w-full rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-200 hover:bg-zinc-700 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Download ZIP</span>
                      </a>
                    ) : hasValidWhatsApp ? (
                      <a
                        href={`https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(
                          `Hello, I want to purchase ${product.title} (Price: ৳${priceBDT} BDT) on BEEEJOY.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Order via WhatsApp</span>
                      </a>
                    ) : (
                      <Link
                        href={`/products/${product.slug}`}
                        className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>View Order Details</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
