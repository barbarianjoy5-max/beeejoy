"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth, getClientAccessToken } from "../../../lib/auth-context";
import { insforge } from "../../../lib/insforge";
import { Product, Vendor, formatPrice } from "../../../lib/types";
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
  const [productCurrency, setProductCurrency] = useState<"BDT" | "USD">("BDT");
  const [productPrice, setProductPrice] = useState("999");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [videoMode, setVideoMode] = useState<"none" | "youtube" | "upload">("none");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
  const [existingPendingVideoPath, setExistingPendingVideoPath] = useState<string | null>(null);
  const [existingPublishedVideoUrl, setExistingPublishedVideoUrl] = useState<string | null>(null);
  const [signedPreviewUrl, setSignedPreviewUrl] = useState<string | null>(null);
  const [loadingPreviewUrl, setLoadingPreviewUrl] = useState(false);
  const [removeExistingVideo, setRemoveExistingVideo] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null);

  // Profile edit state
  const [profileStoreName, setProfileStoreName] = useState("");
  const [profileSlug, setProfileSlug] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileCoverUrl, setProfileCoverUrl] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

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
      setProfileAvatarUrl((profile?.avatar_url || vendor.avatar_url) || "");
      setRemoveAvatar(false);
      setRemoveCover(false);
    }
  }, [vendor, profile]);

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

  // Cover image select with validation
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setFeedback({ type: "error", message: "Please select a valid image file (PNG, JPG, WebP)." });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFeedback({ type: "error", message: "Cover image size cannot exceed 5MB." });
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setRemoveCover(false);
    }
  };

  // Avatar image select with validation
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setFeedback({ type: "error", message: "Please select a valid image file (PNG, JPG, WebP)." });
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        setFeedback({ type: "error", message: "Profile picture size cannot exceed 3MB." });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setRemoveAvatar(false);
    }
  };

  // Reset product upload form
  const resetProductForm = () => {
    setEditingProductId(null);
    setProductTitle("");
    setProductSlug("");
    setProductDescription("");
    setProductType("free");
    setProductCurrency("BDT");
    setProductPrice("999");
    setWhatsappNumber("");
    setVideoMode("none");
    setYoutubeUrl("");
    setVideoFile(null);
    setVideoUploadProgress(null);
    setExistingPendingVideoPath(null);
    setExistingPublishedVideoUrl(null);
    setSignedPreviewUrl(null);
    setRemoveExistingVideo(false);
    setImageFile(null);
    setImagePreview(null);
    setZipFile(null);
    setExistingThumbnailUrl(null);
  };

  // Start edit product
  const startEditProduct = async (prod: Product) => {
    setEditingProductId(prod.id);
    setProductTitle(prod.title);
    setProductSlug(prod.slug);
    setProductDescription(prod.description || "");
    setProductType(prod.product_type === "premium" ? "premium" : "free");
    setProductCurrency((prod.currency === "USD" ? "USD" : "BDT"));
    setProductPrice((prod.price_cents / 100).toString());
    setWhatsappNumber(prod.metadata?.whatsapp_number || "");
    
    const yt = prod.metadata?.youtube_url || "";
    const pendingVid = prod.metadata?.pending_video_path || null;
    const pubVid = prod.metadata?.demo_video_path || null;

    setYoutubeUrl(yt);
    setExistingPendingVideoPath(pendingVid);
    setExistingPublishedVideoUrl(pubVid);
    setSignedPreviewUrl(null);
    setRemoveExistingVideo(false);
    setVideoFile(null);
    setVideoUploadProgress(null);

    if (yt) {
      setVideoMode("youtube");
    } else if (pendingVid || pubVid) {
      setVideoMode("upload");
      if (pendingVid) {
        // Fetch secure preview for pending private video
        fetchSignedPreview(prod.id, pendingVid);
      }
    } else {
      setVideoMode("none");
    }

    setExistingThumbnailUrl(prod.thumbnail_url);
    setImageFile(null);
    setImagePreview(null);
    setZipFile(null);
    setActiveTab("upload");
  };

  const fetchSignedPreview = async (productId?: string, path?: string) => {
    try {
      setLoadingPreviewUrl(true);
      const token = await getClientAccessToken();
      const params = new URLSearchParams();
      if (productId) params.set("productId", productId);
      if (path) params.set("path", path);

      const res = await fetch(`/api/seller/video-preview?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.previewUrl) {
        setSignedPreviewUrl(data.previewUrl);
      }
    } catch (e) {
      console.warn("Failed to load signed preview URL", e);
    } finally {
      setLoadingPreviewUrl(false);
    }
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

      // 3. Upload Demo Video to private software-packages bucket if a new video file was selected
      let pendingVideoPath: string | null = existingPendingVideoPath;
      if (videoMode === "upload" && videoFile) {
        if (!vendor) throw new Error("Vendor profile missing");
        const vidExt = videoFile.name.split(".").pop() || "mp4";
        const vidPath = `pending-videos/${vendor.id}/${cleanSlug}-${Date.now()}.${vidExt}`;
        setVideoUploadProgress(10);
        
        const vidUpload = await insforge.storage.from("software-packages").upload(vidPath, videoFile);
        if (vidUpload.error) {
          throw new Error(`Video upload failed: ${vidUpload.error.message}`);
        }
        setVideoUploadProgress(100);

        // Clean up previous pending video if replacing with a new one
        if (existingPendingVideoPath && existingPendingVideoPath !== vidPath) {
          insforge.storage.from("software-packages").remove([existingPendingVideoPath]).catch(() => {});
        }
        pendingVideoPath = vidPath;
      }

      // If user switched to YouTube or None and had a pending video staged, remove the staged file
      if ((videoMode === "youtube" || videoMode === "none") && existingPendingVideoPath) {
        insforge.storage.from("software-packages").remove([existingPendingVideoPath]).catch(() => {});
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
          currency: productCurrency,
          price: productPrice,
          whatsappNumber,
          youtubeUrl: videoMode === "youtube" ? youtubeUrl.trim() : "",
          pendingVideoPath: videoMode === "upload" ? pendingVideoPath : null,
          removeVideo: videoMode === "none" && (existingPendingVideoPath || existingPublishedVideoUrl),
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
    setUploadProgress(null);

    try {
      let finalCoverUrl: string | null = removeCover ? null : (profileCoverUrl || null);
      let finalAvatarUrl: string | null = removeAvatar ? null : (profileAvatarUrl || null);

      // Upload avatar if new file chosen
      if (avatarFile) {
        setUploadProgress("Uploading profile picture…");
        const ext = avatarFile.name.split(".").pop() || "png";
        const path = `avatars/${vendor?.id || "seller"}-${Date.now()}.${ext}`;
        const { error } = await insforge.storage.from("public-assets").upload(path, avatarFile);
        if (error) throw new Error(`Avatar upload failed: ${error.message}`);
        const { data: urlData } = insforge.storage.from("public-assets").getPublicUrl(path);
        finalAvatarUrl = urlData?.publicUrl || null;
      }

      // Upload cover if new file chosen
      if (coverFile) {
        setUploadProgress("Uploading cover photo…");
        const ext = coverFile.name.split(".").pop() || "png";
        const path = `covers/${vendor?.slug || "seller"}-${Date.now()}.${ext}`;
        const { error } = await insforge.storage.from("public-assets").upload(path, coverFile);
        if (error) throw new Error(`Cover upload failed: ${error.message}`);
        const { data: urlData } = insforge.storage.from("public-assets").getPublicUrl(path);
        finalCoverUrl = urlData?.publicUrl || null;
      }

      setUploadProgress("Saving profile…");
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
          avatarUrl: finalAvatarUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      setFeedback({ type: "success", message: "Profile updated successfully!" });
      setAvatarFile(null);
      setCoverFile(null);
      setCoverPreview(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);
      setRemoveCover(false);
      await refreshProfile();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update profile" });
    } finally {
      setActionLoading(null);
      setUploadProgress(null);
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
                            {p.product_type === "free" ? "Free" : `Premium (${formatPrice(p.price_cents, p.currency || "BDT")})`}
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
                Products undergo review before appearing live in the catalog.
              </p>
            </div>
            {editingProductId && (
              <button
                type="button"
                onClick={resetProductForm}
                className="text-xs text-zinc-400 hover:text-white border border-zinc-800 rounded-lg px-3 py-1.5 transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* BASIC INFORMATION */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-2">
              <span>Basic Information</span>
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Product Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productTitle}
                  onChange={(e) => handleProductTitleChange(e.target.value)}
                  placeholder="e.g. Illustrator Vector Auto-Align"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  URL Slug <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productSlug}
                  onChange={(e) => setProductSlug(e.target.value)}
                  placeholder="vector-auto-align"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Description <span className="text-zinc-500 text-[11px]">(Features & instructions)</span>
              </label>
              <textarea
                rows={3}
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Key features, host compatibility, and instructions..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* PRODUCT TYPE */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/90">
              Product Type
            </h3>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setProductType("free")}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  productType === "free"
                    ? "border-amber-500 bg-amber-500/10 text-white shadow-sm shadow-amber-500/10"
                    : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <div className="font-bold text-xs text-white">Free Download</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">1-click direct download</div>
              </button>
              <button
                type="button"
                onClick={() => setProductType("premium")}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  productType === "premium"
                    ? "border-amber-500 bg-amber-500/10 text-white shadow-sm shadow-amber-500/10"
                    : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <div className="font-bold text-xs text-white">Premium Software</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">WhatsApp direct order</div>
              </button>
            </div>
          </div>

          {/* PRICING & CONTACT (Premium only) */}
          {productType === "premium" && (
            <div className="space-y-4 pt-2 border-t border-zinc-800/80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/90">
                Pricing & WhatsApp Contact
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Price & Currency */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Price & Currency <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 overflow-hidden focus-within:border-amber-500">
                    <select
                      value={productCurrency}
                      onChange={(e) => setProductCurrency(e.target.value as "BDT" | "USD")}
                      className="bg-zinc-900 text-white text-xs font-bold px-3 py-2.5 border-r border-zinc-800 focus:outline-none cursor-pointer"
                    >
                      <option value="BDT">BDT (৳)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                    <span className="text-zinc-500 font-bold px-3 text-sm">
                      {productCurrency === "USD" ? "$" : "৳"}
                    </span>
                    <input
                      type="number"
                      step={productCurrency === "USD" ? "0.01" : "1"}
                      min="0.01"
                      required
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      placeholder={productCurrency === "USD" ? "9.99" : "999"}
                      className="w-full bg-transparent text-white px-2 py-2.5 text-sm focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    WhatsApp Number <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm focus-within:border-amber-500">
                    <MessageCircle className="h-4 w-4 text-emerald-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      required
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="8801876603607"
                      className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none font-mono text-xs"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    7–15 digits without symbols. Customers order directly through this number.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* MEDIA: Thumbnail, ZIP package & Demo Video */}
          <div className="space-y-4 pt-2 border-t border-zinc-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/90">
              Product Media & Files
            </h3>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Thumbnail */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Thumbnail Image <span className="text-rose-400">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                />
                {(imagePreview || existingThumbnailUrl) && (
                  <div className="mt-2.5 flex items-center gap-3">
                    <img
                      src={imagePreview || existingThumbnailUrl || ""}
                      alt="Thumbnail preview"
                      className="h-16 w-16 rounded-xl object-cover border border-zinc-800"
                    />
                    <span className="text-[11px] text-zinc-400">
                      {imageFile ? "New file selected" : "Current thumbnail"}
                    </span>
                  </div>
                )}
              </div>

              {/* Software ZIP */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Software Package <span className="text-zinc-500 text-[11px]">(.zip, .zxp)</span>
                </label>
                <input
                  type="file"
                  accept=".zip,.zxp,.tar.gz,.rar"
                  onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  {productType === "free"
                    ? "Required for 1-click Free software download."
                    : "Optional for Premium (deliverable via WhatsApp)."}
                </p>
                {zipFile && (
                  <p className="mt-1 text-[11px] font-mono text-emerald-400">
                    Selected: {zipFile.name} ({(zipFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>

            {/* DEMO VIDEO (Optional) */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-amber-400" />
                  <span>Demo Video (Optional)</span>
                </label>

                {/* Mode Selector */}
                <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoMode("none");
                      setRemoveExistingVideo(true);
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      videoMode === "none" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoMode("youtube");
                      setRemoveExistingVideo(false);
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      videoMode === "youtube" ? "bg-amber-500 text-zinc-950 font-bold" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoMode("upload");
                      setRemoveExistingVideo(false);
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      videoMode === "upload" ? "bg-amber-500 text-zinc-950 font-bold" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Upload Video
                  </button>
                </div>
              </div>

              {/* YouTube input */}
              {videoMode === "youtube" && (
                <div>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                  {youtubeUrl && getYouTubeEmbedUrl(youtubeUrl) && (
                    <div className="mt-2.5 aspect-video max-w-sm rounded-xl overflow-hidden border border-zinc-800">
                      <iframe
                        src={getYouTubeEmbedUrl(youtubeUrl) || ""}
                        title="Demo Preview"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Video upload input */}
              {videoMode === "upload" && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (f && f.size > 200 * 1024 * 1024) {
                        alert("Video file size cannot exceed 200MB");
                        return;
                      }
                      setVideoFile(f);
                    }}
                    className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Supports .mp4, .webm, .mov (Max 200MB)</span>
                    <span className="text-amber-400/80">Saved securely in private storage until Admin approval</span>
                  </div>

                  {videoFile && (
                    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-xs text-zinc-300 flex items-center justify-between">
                      <span className="font-mono truncate">{videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                      <span className="text-emerald-400 font-semibold shrink-0 ml-2">Ready to upload</span>
                    </div>
                  )}

                  {videoUploadProgress !== null && videoUploadProgress > 0 && (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${videoUploadProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400">Uploading video to secure staging...</span>
                    </div>
                  )}

                  {/* Existing pending or published video preview */}
                  {!videoFile && (signedPreviewUrl || existingPublishedVideoUrl) && (
                    <div className="pt-2">
                      <span className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        Current Video Preview ({existingPendingVideoPath ? "Pending Admin Approval" : "Published"}):
                      </span>
                      <div className="max-w-sm rounded-xl overflow-hidden border border-zinc-800 bg-black">
                        <video
                          src={signedPreviewUrl || existingPublishedVideoUrl || ""}
                          controls
                          className="w-full max-h-48 object-contain"
                        />
                      </div>
                    </div>
                  )}
                  {loadingPreviewUrl && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                      <span>Loading secure preview...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="border-t border-zinc-800/80 pt-4 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={actionLoading === "save_product"}
              className="rounded-xl bg-amber-500 px-6 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              {actionLoading === "save_product" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{editingProductId ? "Resubmit for Review" : "Submit for Review"}</span>
            </button>
          </div>
        </form>
      )}

      {/* 4. MY PROFILE TAB */}
      {activeTab === "profile" && (
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          {/* Header */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
            <div className="border-b border-zinc-800/80 pb-4 mb-6">
              <h2 className="text-lg font-bold text-white">My Profile</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Public store:{" "}
                <Link href={`/seller/${vendor?.slug}`} target="_blank" className="text-amber-400 hover:underline font-mono">
                  /seller/{vendor?.slug}
                </Link>
              </p>
            </div>

            {/* Cover Photo */}
            <div className="mb-6">
              <span className="block text-xs font-bold uppercase text-zinc-400 mb-2">Cover Photo</span>
              {/* Cover preview / placeholder */}
              <div className="relative w-full mb-12">
                <div className="relative w-full aspect-[4/1] rounded-2xl overflow-hidden border border-zinc-800 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950">
                  {!removeCover && (coverPreview || profileCoverUrl) ? (
                    <img
                      src={coverPreview || profileCoverUrl}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-zinc-700" />
                    </div>
                  )}
                </div>
                {/* Avatar overlapping cover centered without being clipped */}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-10">
                  <div className="h-20 w-20 rounded-full border-4 border-zinc-900 bg-zinc-800 overflow-hidden shadow-xl">
                    {!removeAvatar && (avatarPreview || profileAvatarUrl) ? (
                      <img
                        src={avatarPreview || profileAvatarUrl}
                        alt="Avatar"
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-2xl font-black text-zinc-950">
                        {profileStoreName?.charAt(0)?.toUpperCase() || "S"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cover actions */}
              <div className="flex items-center gap-3 mt-2">
                <label className="cursor-pointer rounded-lg bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700 transition-colors">
                  {profileCoverUrl || coverPreview ? "Change Cover" : "Upload Cover"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                </label>
                {(!removeCover && (profileCoverUrl || coverPreview)) && (
                  <button
                    type="button"
                    onClick={() => { setRemoveCover(true); setCoverFile(null); setCoverPreview(null); }}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Remove Cover
                  </button>
                )}
                <span className="text-xs text-zinc-500">Max 5 MB · PNG, JPG, WebP</span>
              </div>
            </div>

            {/* Avatar section (below cover preview) */}
            <div className="pt-2 mb-6">
              <span className="block text-xs font-bold uppercase text-zinc-400 mb-2">Profile Picture</span>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full border-2 border-zinc-700 bg-zinc-800 overflow-hidden shrink-0">
                  {!removeAvatar && (avatarPreview || profileAvatarUrl) ? (
                    <img src={avatarPreview || profileAvatarUrl} alt="Avatar" className="h-full w-full object-cover object-center" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-xl font-black text-zinc-950">
                      {profileStoreName?.charAt(0)?.toUpperCase() || "S"}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cursor-pointer rounded-lg bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700 transition-colors inline-block">
                    {profileAvatarUrl || avatarPreview ? "Change Photo" : "Upload Photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                  {(!removeAvatar && (profileAvatarUrl || avatarPreview)) && (
                    <button
                      type="button"
                      onClick={() => { setRemoveAvatar(true); setAvatarFile(null); setAvatarPreview(null); }}
                      className="text-xs text-rose-400 hover:text-rose-300 transition-colors text-left"
                    >
                      Remove Photo
                    </button>
                  )}
                  <span className="text-xs text-zinc-500">Max 3 MB · PNG, JPG, WebP</span>
                </div>
              </div>
            </div>

            {/* Text fields */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">
                  Store Name <span className="text-rose-400">*</span>
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
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">
                  Store Username <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm">
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

            <div className="mt-5">
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">
                Short Bio <span className="text-zinc-500 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                placeholder="Tell customers about the software, CEP plugins, or tools you build…"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none resize-none"
              />
            </div>

            {/* Upload progress */}
            {uploadProgress && (
              <div className="flex items-center gap-2 mt-3 text-xs text-amber-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{uploadProgress}</span>
              </div>
            )}

            {/* Save */}
            <div className="border-t border-zinc-800/80 mt-6 pt-4 flex justify-end">
              <button
                type="submit"
                disabled={actionLoading === "update_profile"}
                className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {actionLoading === "update_profile" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>Save Profile</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
