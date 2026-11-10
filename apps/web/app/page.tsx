"use client";

import React, { useEffect, useState, useRef } from "react";
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
import { Product, PublicVendor, formatPrice, formatOrderMessage, HomepageAnimationConfig, HeroContentConfig } from "../lib/types";
import { DEFAULT_HERO_CONTENT, normalizeHeroContent } from "../lib/hero-content";
import TypewriterText from "../components/TypewriterText";

/**
 * Hero copy block shared by both hero layouts (with and without the right-side
 * video). The static heading stays visible while the highlighted phrase types.
 */
function HeroCopy({
  hero,
  centered,
  headingClassName,
}: {
  hero: HeroContentConfig;
  centered: boolean;
  headingClassName: string;
}) {
  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Official BEEEJOY Software Catalog & Creator Marketplace</span>
      </div>

      <h1 className={`mt-8 font-extrabold tracking-tight text-white ${headingClassName}`}>
        <span className="block">{hero.heading}</span>
        <span className="mt-1 block text-amber-400">
          <TypewriterText
            phrases={hero.phrases}
            enabled={hero.typewriter_enabled}
            cursor={hero.cursor_enabled}
            typingSpeed={hero.typing_speed_ms}
            deletingSpeed={hero.deleting_speed_ms}
            pauseDuration={hero.pause_ms}
          />
        </span>
      </h1>

      <p
        className={`mt-6 text-base sm:text-lg leading-8 text-zinc-400 max-w-2xl ${
          centered ? "mx-auto" : "mx-auto lg:mx-0"
        }`}
      >
        {hero.description}
      </p>
    </>
  );
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "free" | "premium">("all");
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [animation, setAnimation] = useState<HomepageAnimationConfig | null>(null);
  const [hero, setHero] = useState<HeroContentConfig>(DEFAULT_HERO_CONTENT);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Hero content is editable from the Admin Dashboard and applies immediately.
  useEffect(() => {
    let mounted = true;
    fetch("/api/site/hero-content")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.hero) {
          setHero(normalizeHeroContent(data.hero));
        }
      })
      .catch((err) => console.warn("Could not load hero content:", err));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    async function loadAnimation() {
      try {
        const res = await fetch("/api/homepage/animation");
        const data = await res.json();
        if (data?.animation?.enabled && data?.animation?.video_url) {
          setAnimation(data.animation);
        }
      } catch (err) {
        console.warn("Could not load homepage animation:", err);
      }
    }
    loadAnimation();
  }, []);

  // Guarantee browser autoplay: explicitly set DOM properties and trigger play()
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !animation?.video_url) return;

    video.muted = true;
    video.defaultMuted = true;

    const playVideo = () => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Autoplay was prevented by browser policy:", err);
        });
      }
    };

    if (video.readyState >= 2) {
      playVideo();
    } else {
      video.addEventListener("loadeddata", playVideo, { once: true });
      video.addEventListener("canplay", playVideo, { once: true });
    }

    return () => {
      video.removeEventListener("loadeddata", playVideo);
      video.removeEventListener("canplay", playVideo);
    };
  }, [animation?.video_url]);

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

        // Load software categories for the dynamic filter (public read policy)
        const { data: catsData } = await insforge.database
          .from("categories")
          .select("id, name, slug")
          .order("display_order", { ascending: true });
        if (Array.isArray(catsData)) {
          setCategories(catsData as any);
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
    if (filter === "free") return p.product_type === "free" && (categoryFilter === "all" || p.category_id === categoryFilter);
    if (filter === "premium") return p.product_type === "premium" && (categoryFilter === "all" || p.category_id === categoryFilter);
    return categoryFilter === "all" || p.category_id === categoryFilter;
  });

  const hasActiveAnimation = Boolean(animation?.enabled && animation?.video_url);

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden px-6 py-16 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_50%_at_50%_40%,rgba(245,158,11,0.12),rgb(var(--zinc-950)_/_0))] pointer-events-none" />
        
        {hasActiveAnimation ? (
          /* Responsive 2-column layout when Hero animation is enabled */
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
              {/* Left Column: Headline, Description & CTAs */}
              <div className="text-center lg:text-left lg:col-span-7">
                <HeroCopy hero={hero} centered={false} headingClassName="text-4xl sm:text-5xl lg:text-6xl" />

                <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-4">
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

              {/* Right Column: Seamless Dark-Blended Autoplaying Looping Animation */}
              <div className="flex items-center justify-center lg:col-span-5">
                <div className="relative w-full max-w-md sm:max-w-lg aspect-square overflow-hidden rounded-3xl bg-transparent">
                  {/* Vignette blend around edges into dark background */}
                  <div className="absolute inset-0 z-10 pointer-events-none rounded-3xl ring-1 ring-inset ring-white/5 bg-[radial-gradient(circle_at_center,transparent_55%,rgb(var(--zinc-950)_/_0.85)_100%)] shadow-2xl shadow-amber-500/5" />
                  <video
                    ref={videoRef}
                    key={animation!.video_url!}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    onLoadedMetadata={(e) => {
                      e.currentTarget.muted = true;
                      const p = e.currentTarget.play();
                      if (p !== undefined) p.catch(() => {});
                    }}
                    className="w-full h-full object-cover object-center pointer-events-none select-none rounded-3xl"
                  >
                    <source src={animation!.video_url!} type="video/mp4" />
                    <source src={animation!.video_url!} type="video/webm" />
                  </video>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Preserved original centered 1-column layout when animation is disabled/absent */
          <div className="mx-auto max-w-4xl text-center">
            <HeroCopy hero={hero} centered headingClassName="text-4xl sm:text-6xl" />

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
        )}
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

        {/* Category Filter Pills */}
        {!isLoading && categories.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                categoryFilter === "all"
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white hover:border-zinc-700"
              }`}
            >
              All Software
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  categoryFilter === c.id
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white hover:border-zinc-700"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

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
              const priceFormatted = formatPrice(product.price_cents || 0, product.currency || "BDT");
              const cleanWhatsApp = product.metadata?.whatsapp_number
                ? String(product.metadata.whatsapp_number).replace(/[\s\+\-\(\)]/g, "").trim()
                : null;
              const hasValidWhatsApp = Boolean(cleanWhatsApp && /^[0-9]{7,15}$/.test(cleanWhatsApp));
              const orderMessage = encodeURIComponent(
                formatOrderMessage(product.title, product.price_cents || 0, product.currency || "BDT")
              );

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
                            <span className="text-2xl font-black text-amber-400">{priceFormatted}</span>
                            <span className="text-xs text-zinc-500">{product.currency || "BDT"}</span>
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
                            href={`https://wa.me/${cleanWhatsApp}?text=${orderMessage}`}
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
