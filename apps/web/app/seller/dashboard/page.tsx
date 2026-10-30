"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth, getClientAccessToken } from "../../../lib/auth-context";
import { insforge } from "../../../lib/insforge";
import { Product, Vendor } from "../../../lib/types";
import { getYouTubeEmbedUrl } from "../../../lib/youtube";
import {
  Package,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileArchive,
  Image as ImageIcon,
  Edit2,
  ExternalLink,
  Video,
  MessageCircle,
  Store,
  Layers,
  UserCheck,
  Loader2,
  RefreshCw,
  Plus,
  Send,
  Eye,
} from "lucide-react";
import Link from "next/link";

export default function SellerDashboardPage() {
  const { user, profile, vendor, isSeller, isLoading: authLoading, openAuthModal, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "upload" | "profile">("overview");

  // Seller products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Application form state (for non-sellers)
  const [applyStoreName, setApplyStoreName] = useState("");
  const [applySlug, setApplySlug] = useState("");
  const [applyBio, setApplyBio] = useState("");

  // Product upload/edit form state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productType, setProductType] = useState<"free" | "premium">("free");
  const [productPriceBdt, setProductPriceBdt] = useState("999");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null);

  // Profile edit state
  const [profileStoreName, setProfileStoreName] = useState("");
  const [profileSlug, setProfileSlug] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileCoverUrl, setProfileCoverUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Load seller's products
  const loadSellerProducts = useCallback(async () => {
    if (!user) return;
    setLoadingProducts(true);
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/seller/products", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load products");
      setProducts(data.products || []);
    } catch (err: any) {
      console.warn("Error loading seller products:", err);
    } finally {
      setLoadingProducts(false);
    }
  }, [user]);

  // Sync profile edit form with vendor data
  useEffect(() => {
    if (vendor) {
      setProfileStoreName(vendor.store_name);
      setProfileSlug(vendor.slug);
      setProfileBio(vendor.bio || "");
      setProfileCoverUrl(vendor.cover_url || "");
    }
  }, [vendor]);

  useEffect(() => {
    if (isSeller) {
      loadSellerProducts();
    }
  }, [isSeller, loadSellerProducts]);

  // Auto-slug generator for new product
  const handleProductTitleChange = (val: string) => {
    setProductTitle(val);
    if (!editingProductId) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setProductSlug(generatedSlug);
    }
  };

  // Auto-slug generator for application
  const handleApplyStoreNameChange = (val: string) => {
    setApplyStoreName(val);
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setApplySlug(generatedSlug);
  };

  // Image select
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Cover image select
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  // Reset product upload form
  const resetProductForm = () => {
    setEditingProductId(null);
    setProductTitle("");
    setProductSlug("");
    setProductDescription("");
    setProductType("free");
    setProductPriceBdt("999");
    setWhatsappNumber("");
    setYoutubeUrl("");
    setImageFile(null);
    setImagePreview(null);
    setZipFile(null);
    setExistingThumbnailUrl(null);
  };

  // Start edit product
  const startEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setProductTitle(prod.title);
    setProductSlug(prod.slug);
    setProductDescription(prod.description || "");
    setProductType(prod.product_type === "premium" ? "premium" : "free");
    setProductPriceBdt((prod.price_cents / 100).toString());
    setWhatsappNumber(prod.metadata?.whatsapp_number || "");
    setYoutubeUrl(prod.metadata?.youtube_url || "");
    setExistingThumbnailUrl(prod.thumbnail_url);
    setImageFile(null);
    setImagePreview(null);
    setZipFile(null);
    setActiveTab("upload");
  };

  // Handle seller application submission
  const handleApplySeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setActionLoading("apply");
    setFeedback(null);

    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/seller/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeName: applyStoreName,
          slug: applySlug,
          bio: applyBio,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit application");

      setFeedback({ type: "success", message: data.message });
      await refreshProfile();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle product save (Create or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isSeller) return;
    setActionLoading("save_product");
    setFeedback(null);

    try {
      const cleanSlug = productSlug.trim().toLowerCase();
      if (!cleanSlug) throw new Error("Product slug is required.");
      if (!productTitle.trim()) throw new Error("Product name is required.");

      let finalThumbnailUrl = existingThumbnailUrl;

      // 1. Upload thumbnail image to public-assets bucket if a new file was chosen
      if (imageFile) {
        const imgExt = imageFile.name.split(".").pop() || "png";
        const imgPath = `thumbnails/${cleanSlug}-${Date.now()}.${imgExt}`;
        const uploadRes = await insforge.storage.from("public-assets").upload(imgPath, imageFile);
        if (uploadRes.error) {
          throw new Error(`Thumbnail upload failed: ${uploadRes.error.message}`);
        }
        const { data: urlData } = insforge.storage.from("public-assets").getPublicUrl(imgPath);
        finalThumbnailUrl = urlData?.publicUrl || null;
      }

      // 2. Upload ZIP file to private software-packages bucket if provided
      let zipStoragePath: string | null = null;
      let zipSize: number | null = null;
      if (zipFile) {
        const pkgExt = zipFile.name.split(".").pop() || "zip";
        const pkgPath = `releases/${cleanSlug}-${Date.now()}.${pkgExt}`;
        const pkgUpload = await insforge.storage.from("software-packages").upload(pkgPath, zipFile);
        if (pkgUpload.error) {
          throw new Error(`Software package upload failed: ${pkgUpload.error.message}`);
        }
        zipStoragePath = pkgPath;
        zipSize = zipFile.size;
      }

      const token = await getClientAccessToken();
      const endpoint = "/api/seller/products";
      const method = editingProductId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingProductId || undefined,
          title: productTitle.trim(),
          slug: cleanSlug,
          description: productDescription.trim(),
          productType,
          priceBdt: productPriceBdt,
          whatsappNumber,
          youtubeUrl,
          thumbnailUrl: finalThumbnailUrl,
          zipStoragePath,
          zipSize,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save product");

      setFeedback({
        type: "success",
        message: data.message || "Product submitted for Admin review!",
      });

      resetProductForm();
      setActiveTab("products");
      await loadSellerProducts();
    } catch (err: any) {
      console.error("Save product error:", err);
      setFeedback({ type: "error", message: err.message || "Failed to save product" });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle seller profile update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isSeller) return;
    setActionLoading("update_profile");
    setFeedback(null);

    try {
      let finalCoverUrl = profileCoverUrl;

      // Upload cover photo if file selected
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() || "png";
        const coverPath = `covers/${vendor?.slug || "seller"}-${Date.now()}.${ext}`;
        const uploadRes = await insforge.storage.from("public-assets").upload(coverPath, coverFile);
        if (uploadRes.error) {
          throw new Error(`Cover upload failed: ${uploadRes.error.message}`);
        }
        const { data: urlData } = insforge.storage.from("public-assets").getPublicUrl(coverPath);
        finalCoverUrl = urlData?.publicUrl || "";
      }

      const token = await getClientAccessToken();
      const res = await fetch("/api/seller/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeName: profileStoreName,
          slug: profileSlug,
          bio: profileBio,
          coverUrl: finalCoverUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      setFeedback({ type: "success", message: "Seller profile updated successfully!" });
      await refreshProfile();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update profile" });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-6">
          <Store className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">Sign In Required</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in or create an account to access the BEEEJOY Seller Dashboard or apply to become a seller.
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

  // Customer has applied, but status is pending
  if (vendor?.status === "pending" && !isSeller) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-6">
          <Clock className="h-7 w-7 animate-pulse" />
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-400">
          Pending Admin Review
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-white">Application Under Review</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your seller application for <span className="font-semibold text-white">"{vendor.store_name}"</span> (
          <code className="text-amber-400">@{vendor.slug}</code>) has been submitted and is currently being reviewed by
          the BEEEJOY admin team.
        </p>
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-400">
          Once approved, you will be able to upload your software, manage your products, and set up your public seller
          profile.
        </div>
        <button
          onClick={() => refreshProfile()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>
    );
  }

  // Suspended seller
  if (vendor?.status === "suspended" && !isSeller) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-6">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Seller Account Suspended</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your seller access has been suspended by the administrator. Please contact BEEEJOY support for more
          information.
        </p>
      </div>
    );
  }

  // Customer has not applied yet: Show Seller Application form
  if (!isSeller && !vendor) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
            <Store className="h-6 w-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Creator Marketplace</span>
          <h1 className="mt-2 text-3xl font-extrabold text-white">Apply to Become a Seller</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Publish your Adobe Illustrator extensions and software tools on BEEEJOY. Submit a quick application to get
            started.
          </p>
        </div>

        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl text-xs flex items-center gap-2.5 border ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleApplySeller} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
              Store / Seller Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={applyStoreName}
              onChange={(e) => handleApplyStoreNameChange(e.target.value)}
              placeholder="e.g. Joy Script Studio"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
              Store Username / URL Slug <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-400">
              <span className="select-none text-zinc-500">beeejoy.com/seller/</span>
              <input
                type="text"
                required
                value={applySlug}
                onChange={(e) => setApplySlug(e.target.value)}
                placeholder="joy-scripts"
                className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none ml-1 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
              Short Bio <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={applyBio}
              onChange={(e) => setApplyBio(e.target.value)}
              placeholder="Tell customers about the software, CEP plugins, or automation scripts you build..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={actionLoading === "apply"}
            className="w-full rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {actionLoading === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>Submit Seller Application</span>
          </button>
        </form>
      </div>
    );
  }

  // --- APPROVED SELLER DASHBOARD ---
  const publishedCount = products.filter((p) => p.status === "published").length;
  const pendingCount = products.filter((p) => p.status === "pending_review").length;
  const draftCount = products.filter((p) => p.status === "draft").length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
              Active Seller
            </span>
            <span className="text-xs text-zinc-500">&bull;</span>
            <span className="text-xs text-zinc-400 font-mono">@{vendor?.slug}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <span>{vendor?.store_name}</span>
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Manage your software products, upload releases for review, and update your public seller profile.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/seller/${vendor?.slug}`}
            target="_blank"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
          >
            <Eye className="h-3.5 w-3.5 text-amber-400" />
            <span>View Public Store</span>
            <ExternalLink className="h-3 w-3 text-zinc-500" />
          </Link>
          <button
            onClick={() => {
              resetProductForm();
              setActiveTab("upload");
            }}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Upload Product</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/60 mt-6 mb-8 overflow-x-auto pb-1">
        {[
          { id: "overview", label: "Overview", icon: Layers },
          { id: "products", label: `My Products (${products.length})`, icon: Package },
          { id: "upload", label: editingProductId ? "Edit Product" : "Upload Product", icon: Upload },
          { id: "profile", label: "My Profile", icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-zinc-500 hover:text-white text-xs">
            &times;
          </button>
        </div>
      )}

      {/* 1. OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Products</span>
              <p className="mt-2 text-3xl font-black text-white">{products.length}</p>
              <p className="mt-1 text-[11px] text-zinc-500">All submitted items</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Live & Published</span>
              <p className="mt-2 text-3xl font-black text-emerald-400">{publishedCount}</p>
              <p className="mt-1 text-[11px] text-zinc-500">Visible on storefront</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Pending Review</span>
              <p className="mt-2 text-3xl font-black text-amber-400">{pendingCount}</p>
              <p className="mt-1 text-[11px] text-zinc-500">Awaiting Admin approval</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Draft / Changes</span>
              <p className="mt-2 text-3xl font-black text-zinc-300">{draftCount}</p>
              <p className="mt-1 text-[11px] text-zinc-500">Needs edit / draft</p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h3 className="text-sm font-bold text-white mb-2">Seller Guidelines</h3>
            <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
              <li>Every uploaded product begins with status <span className="text-amber-400 font-semibold">Pending Review</span>.</li>
              <li>The BEEEJOY administrator tests and approves software packages before they appear publicly.</li>
              <li>Free products allow visitors direct 1-click ZIP downloads.</li>
              <li>Premium products require your WhatsApp number so buyers can contact you directly with bKash/Nagad payments.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 2. MY PRODUCTS TAB */}
      {activeTab === "products" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Your Products</h2>
            <button
              onClick={loadSellerProducts}
              disabled={loadingProducts}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
            >
              <RefreshCw className={`h-3 w-3 ${loadingProducts ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingProducts ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <Package className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No products yet</h3>
              <p className="mt-1 text-xs text-zinc-400">Upload your first tool or extension to submit it for review.</p>
              <button
                onClick={() => {
                  resetProductForm();
                  setActiveTab("upload");
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950"
              >
                <Plus className="h-4 w-4" />
                <span>Upload Product</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {products.map((p) => {
                const isPublished = p.status === "published";
                const isPending = p.status === "pending_review";
                return (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {p.thumbnail_url ? (
                        <img
                          src={p.thumbnail_url}
                          alt={p.title}
                          className="h-14 w-14 rounded-xl object-cover bg-zinc-950 border border-zinc-800 shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{p.title}</h4>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              isPublished
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : isPending
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : "bg-zinc-700/20 text-zinc-400 border border-zinc-700/40"
                            }`}
                          >
                            {isPublished ? "Live / Published" : isPending ? "Pending Review" : "Draft"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 mt-1">
                          <span className="font-mono text-zinc-500">/{p.slug}</span>
                          <span>&bull;</span>
                          <span className="capitalize font-semibold text-zinc-300">
                            {p.product_type === "free" ? "Free" : `Premium (৳${p.price_cents / 100})`}
                          </span>
                          {p.metadata?.whatsapp_number && (
                            <>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1 text-emerald-400">
                                <MessageCircle className="h-3 w-3" />
                                <span>{p.metadata.whatsapp_number}</span>
                              </span>
                            </>
                          )}
                        </div>
                        {p.metadata?.admin_feedback && (
                          <div className="mt-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs text-rose-300">
                            <span className="font-bold">Admin Feedback:</span> {p.metadata.admin_feedback}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isPublished && (
                        <Link
                          href={`/products/${p.slug}`}
                          target="_blank"
                          className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Live</span>
                        </Link>
                      )}
                      <button
                        onClick={() => startEditProduct(p)}
                        className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white hover:border-amber-500/50"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-amber-400" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. UPLOAD / EDIT PRODUCT TAB */}
      {activeTab === "upload" && (
        <form onSubmit={handleSaveProduct} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                {editingProductId ? "Edit Product" : "Upload New Product"}
              </h2>
              <p className="text-xs text-zinc-400">
                Products will be submitted to the BEEEJOY Admin team for security review and verification.
              </p>
            </div>
            {editingProductId && (
              <button
                type="button"
                onClick={resetProductForm}
                className="text-xs text-zinc-400 hover:text-white border border-zinc-800 rounded-lg px-3 py-1.5"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* Title & Slug */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                Product Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={productTitle}
                onChange={(e) => handleProductTitleChange(e.target.value)}
                placeholder="e.g. Illustrator Vector Auto-Align"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                URL Slug <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={productSlug}
                onChange={(e) => setProductSlug(e.target.value)}
                placeholder="vector-auto-align"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-mono text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
              Description <span className="text-zinc-500 font-normal">(Features & Usage)</span>
            </label>
            <textarea
              rows={4}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Describe what your tool does, host compatibility, and instructions..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Type & Price */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">Product Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProductType("free")}
                  className={`rounded-xl border p-3 text-xs font-bold transition-all ${
                    productType === "free"
                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  Free Download
                </button>
                <button
                  type="button"
                  onClick={() => setProductType("premium")}
                  className={`rounded-xl border p-3 text-xs font-bold transition-all ${
                    productType === "premium"
                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  Premium Software
                </button>
              </div>
            </div>

            {productType === "premium" ? (
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                  Price in BDT (৳) <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm">
                  <span className="text-zinc-500 font-bold mr-2">৳</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={productPriceBdt}
                    onChange={(e) => setProductPriceBdt(e.target.value)}
                    placeholder="999"
                    className="w-full bg-transparent text-white focus:outline-none"
                  />
                  <span className="text-xs text-zinc-500 uppercase font-mono">BDT</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5 text-xs text-zinc-400">
                <span>Free software will be available for direct 1-click ZIP download upon approval.</span>
              </div>
            )}
          </div>

          {/* WhatsApp Number (required for premium) */}
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
              WhatsApp Contact Number {productType === "premium" ? <span className="text-rose-400">*</span> : <span className="text-zinc-500 font-normal">(Optional for Free)</span>}
            </label>
            <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm">
              <MessageCircle className="h-4 w-4 text-emerald-400 mr-2 shrink-0" />
              <input
                type="text"
                required={productType === "premium"}
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. 8801876603607"
                className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none font-mono"
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              International format digits only (7-15 digits, e.g. 8801XXXXXXXXX). Customers will order via WhatsApp to this number.
            </p>
          </div>

          {/* YouTube Demo URL */}
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
              YouTube Demo URL <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm">
              <Video className="h-4 w-4 text-rose-400 mr-2 shrink-0" />
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
            {youtubeUrl && getYouTubeEmbedUrl(youtubeUrl) && (
              <div className="mt-3 aspect-video max-w-md rounded-xl overflow-hidden border border-zinc-800">
                <iframe
                  src={getYouTubeEmbedUrl(youtubeUrl) || ""}
                  title="Demo preview"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}
          </div>

          {/* Files: Thumbnail & ZIP */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                Thumbnail Image <span className="text-zinc-500 font-normal">(PNG / JPG)</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-xs file:font-bold file:text-zinc-200 hover:file:bg-zinc-700"
              />
              {(imagePreview || existingThumbnailUrl) && (
                <div className="mt-3">
                  <img
                    src={imagePreview || existingThumbnailUrl || ""}
                    alt="Preview"
                    className="h-24 w-24 rounded-xl object-cover border border-zinc-800"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                Software Package <span className="text-zinc-500 font-normal">(.ZIP / .ZXP)</span>
              </label>
              <input
                type="file"
                accept=".zip,.zxp,.tar.gz,.rar"
                onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-xs file:font-bold file:text-zinc-200 hover:file:bg-zinc-700"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Packages are saved securely in private storage and only accessible after Admin approval.
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-800/80 pt-4 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={actionLoading === "save_product"}
              className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading === "save_product" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{editingProductId ? "Resubmit for Review" : "Submit Product for Review"}</span>
            </button>
          </div>
        </form>
      )}

      {/* 4. MY PROFILE TAB */}
      {activeTab === "profile" && (
        <form onSubmit={handleUpdateProfile} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 space-y-6">
          <div className="border-b border-zinc-800/80 pb-4">
            <h2 className="text-lg font-bold text-white">Edit Seller Profile</h2>
            <p className="text-xs text-zinc-400">
              Customize how your store appears to customers on your public profile:{" "}
              <Link href={`/seller/${vendor?.slug}`} target="_blank" className="text-amber-400 hover:underline">
                /seller/{vendor?.slug}
              </Link>
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                Store / Seller Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={profileStoreName}
                onChange={(e) => setProfileStoreName(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                Store URL Username (Slug) <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-400">
                <span className="select-none text-zinc-500">/seller/</span>
                <input
                  type="text"
                  required
                  value={profileSlug}
                  onChange={(e) => setProfileSlug(e.target.value)}
                  className="w-full bg-transparent text-white font-mono focus:outline-none ml-1"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
              Short Bio <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={profileBio}
              onChange={(e) => setProfileBio(e.target.value)}
              placeholder="Tell customers about the software, CEP plugins, or automation scripts you build..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
              Cover Photo <span className="text-zinc-500 font-normal">(Optional banner)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-xs file:font-bold file:text-zinc-200 hover:file:bg-zinc-700"
            />
            {(coverPreview || profileCoverUrl) && (
              <div className="mt-3 aspect-[3/1] max-w-xl rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                <img
                  src={coverPreview || profileCoverUrl}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800/80 pt-4 flex justify-end">
            <button
              type="submit"
              disabled={actionLoading === "update_profile"}
              className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading === "update_profile" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
