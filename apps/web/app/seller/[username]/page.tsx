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
  Calendar,
  Package,
  User,
} from "lucide-react";
import { Product, formatPrice } from "../../../lib/types";

interface PublicVendorData {
  id: string;
  store_name: string;
  slug: string;
  bio: string | null;
  cover_url: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface PageProps {
  params: Promise<{ username: string }>;
}

export default function PublicSellerProfilePage({ params }: PageProps) {
  const { username } = use(params);
  const [vendor, setVendor] = useState<PublicVendorData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadSellerProfile() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/sellers/${username}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!data.vendor) {
          setNotFound(true);
          return;
        }
        setVendor(data.vendor);
        setProducts(data.products || []);
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
      <div className="mx-auto max-w-6xl px-6 py-10 animate-pulse">
        <div className="h-4 w-32 bg-zinc-800 rounded mb-6" />
        <div className="aspect-[5/1] w-full rounded-3xl bg-zinc-800/60 mb-16" />
        <div className="h-8 w-64 bg-zinc-800 rounded mb-3" />
        <div className="h-4 w-96 bg-zinc-800/60 rounded mb-10" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

  const initials = vendor.store_name.charAt(0).toUpperCase();

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

      {/* Cover Banner */}
      <div className="relative w-full overflow-hidden rounded-3xl border border-zinc-800">
        {vendor.cover_url ? (
          <div className="aspect-[5/1] w-full overflow-hidden">
            <img
              src={vendor.cover_url}
              alt={vendor.store_name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[5/1] sm:aspect-[6/1] w-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-500/15 via-zinc-900/60 to-zinc-950" />
        )}

        {/* Circular avatar overlapping cover bottom-left */}
        <div className="absolute bottom-0 left-6 sm:left-8 translate-y-1/2">
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-zinc-950 bg-zinc-800 overflow-hidden shadow-2xl shadow-black/40">
            {vendor.avatar_url ? (
              <img src={vendor.avatar_url} alt={vendor.store_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-3xl font-black text-zinc-950">
                {initials}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Identity Row */}
      <div className="mt-16 sm:mt-18 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{vendor.store_name}</h1>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
              Verified Seller
            </span>
          </div>
          <p className="font-mono text-xs text-amber-400/90 mt-0.5">@{vendor.slug}</p>
          {vendor.bio && (
            <p className="mt-2 text-sm text-zinc-300 max-w-2xl leading-relaxed">{vendor.bio}</p>
          )}
          <div className="flex items-center gap-4 text-[11px] text-zinc-500 mt-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Member since {new Date(vendor.created_at).toLocaleDateString()}</span>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1 text-zinc-400 font-semibold">
              <Package className="h-3 w-3 text-amber-400" />
              <span>{products.length} Published {products.length === 1 ? "Product" : "Products"}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <section className="mt-10">
        <div className="mb-6">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Software Releases</span>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-white">
            Products by {vendor.store_name}
          </h2>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-14 text-center">
            <PackageCheck className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No products available yet</h3>
            <p className="mt-1 text-xs text-zinc-400">
              This seller has not published any software products to the marketplace yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const isFree = product.product_type === "free";
              const cleanWhatsApp = product.metadata?.whatsapp_number
                ? String(product.metadata.whatsapp_number).replace(/[\s\+\-\(\)]/g, "").trim()
                : null;
              const hasValidWhatsApp = Boolean(cleanWhatsApp && /^[0-9]{7,15}$/.test(cleanWhatsApp));
              const priceLabel = formatPrice(product.price_cents, product.currency);
              const whatsappMsg = encodeURIComponent(
                `Hello, I want to purchase ${product.title} (Price: ${priceLabel}) on BEEEJOY.`
              );

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
                            <span className="text-amber-400">{priceLabel}</span>
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
                        href={`https://wa.me/${cleanWhatsApp}?text=${whatsappMsg}`}
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
