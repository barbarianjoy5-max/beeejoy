"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { insforge } from "../../lib/insforge";
import { Product } from "../../lib/types";
import { getYouTubeVideoId, getYouTubeEmbedUrl } from "../../lib/youtube";
import {
  Package,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Plus,
  AlertCircle,
  FileArchive,
  Image as ImageIcon,
  Download,
  Trash2,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Video,
  ShieldCheck,
  Check,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { user, profile, isAdmin, isLoading: authLoading } = useAuth();
  const [loadingData, setLoadingData] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Products list
  const [products, setProducts] = useState<Product[]>([]);

  // Form state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productType, setProductType] = useState<"free" | "premium">("free");
  const [productPriceBdt, setProductPriceBdt] = useState("999");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  // Files
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null);

  // Load products list from database
  const loadProducts = async () => {
    setLoadingData(true);
    setFeedback(null);
    try {
      const { data, error } = await insforge.database
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setProducts(data as Product[]);
    } catch (err: any) {
      console.error("Error loading products:", err);
      setFeedback({ type: "error", message: err?.message || "Failed to load products" });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadProducts();
    }
  }, [isAdmin]);

  // Handle title change and auto-generate slug
  const handleTitleChange = (val: string) => {
    setProductTitle(val);
    if (!editingProductId) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setProductSlug(generatedSlug);
    }
  };

  // Handle image file selection with preview
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  // Reset form
  const resetForm = () => {
    setEditingProductId(null);
    setProductTitle("");
    setProductSlug("");
    setProductDescription("");
    setProductType("free");
    setProductPriceBdt("999");
    setWhatsappNumber("");
    setYoutubeUrl("");
    setIsPublished(true);
    setImageFile(null);
    setImagePreview(null);
    setZipFile(null);
    setExistingThumbnailUrl(null);
  };

  // Start editing a product
  const startEdit = (prod: Product) => {
    setEditingProductId(prod.id);
    setProductTitle(prod.title);
    setProductSlug(prod.slug);
    setProductDescription(prod.description || "");
    setProductType(prod.product_type === "premium" ? "premium" : "free");
    setProductPriceBdt((prod.price_cents / 100).toString());
    setWhatsappNumber(prod.metadata?.whatsapp_number || "");
    setYoutubeUrl(prod.metadata?.youtube_url || "");
    setIsPublished(prod.status === "published");
    setExistingThumbnailUrl(prod.thumbnail_url);
    setImageFile(null);
    setImagePreview(null);
    setZipFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Submit product (Create or Edit)
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setActionLoading("save_product");
    setFeedback(null);

    try {
      const cleanSlug = productSlug.trim().toLowerCase();
      if (!cleanSlug) throw new Error("Product slug is required.");
      if (!productTitle.trim()) throw new Error("Product name is required.");

      // Clean WhatsApp number (digits only without symbols)
      const cleanWhatsAppNumber = whatsappNumber.replace(/[\s\+\-\(\)]/g, "").trim();

      // Explicit JS price validation for Premium
      if (productType === "premium") {
        const parsedPrice = parseFloat(productPriceBdt || "");
        if (!productPriceBdt || isNaN(parsedPrice) || parsedPrice <= 0) {
          throw new Error("Please enter a valid price (greater than 0) for Premium software.");
        }
        if (!cleanWhatsAppNumber) {
          throw new Error("WhatsApp contact number is required for Premium software products.");
        }
        if (!/^[0-9]{7,15}$/.test(cleanWhatsAppNumber)) {
          throw new Error("Please enter a valid international WhatsApp number (7-15 digits without symbols, e.g. 8801XXXXXXXXX).");
        }
      } else if (cleanWhatsAppNumber && !/^[0-9]{7,15}$/.test(cleanWhatsAppNumber)) {
        throw new Error("Please enter a valid international WhatsApp number (7-15 digits, e.g. 8801XXXXXXXXX) or leave it empty.");
      }

      let finalThumbnailUrl = existingThumbnailUrl;

      // 1. Upload thumbnail image to public-assets bucket if provided
      if (imageFile) {
        const imgExt = imageFile.name.split(".").pop() || "png";
        const imgPath = `thumbnails/${cleanSlug}-${Date.now()}.${imgExt}`;

        const uploadRes = await insforge.storage.from("public-assets").upload(imgPath, imageFile);
        if (uploadRes.error) {
          throw new Error(`Image upload failed: ${uploadRes.error.message}`);
        }

        const { data: urlData } = insforge.storage.from("public-assets").getPublicUrl(imgPath);
        finalThumbnailUrl = urlData?.publicUrl || null;
      }

      // Calculate price
      const priceCents =
        productType === "free" ? 0 : Math.round(parseFloat(productPriceBdt || "0") * 100);

      // Preserve existing metadata from product when editing
      const existingProduct = products.find((p) => p.id === editingProductId);
      const metadataPayload: Record<string, any> = {
        ...(editingProductId ? existingProduct?.metadata || {} : {}),
      };

      if (youtubeUrl.trim()) {
        metadataPayload.youtube_url = youtubeUrl.trim();
      } else {
        delete metadataPayload.youtube_url;
      }

      if (cleanWhatsAppNumber) {
        metadataPayload.whatsapp_number = cleanWhatsAppNumber;
      } else {
        delete metadataPayload.whatsapp_number;
      }

      let productId = editingProductId;

      if (editingProductId) {
        // UPDATE existing product
        const { error: updErr } = await insforge.database
          .from("products")
          .update({
            title: productTitle.trim(),
            slug: cleanSlug,
            description: productDescription.trim() || null,
            product_type: productType,
            price_cents: priceCents,
            status: isPublished ? "published" : "draft",
            thumbnail_url: finalThumbnailUrl,
            metadata: metadataPayload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingProductId);

        if (updErr) throw updErr;
      } else {
        // INSERT new product
        const { data: newProd, error: insErr } = await insforge.database
          .from("products")
          .insert([
            {
              title: productTitle.trim(),
              slug: cleanSlug,
              description: productDescription.trim() || null,
              product_type: productType,
              price_cents: priceCents,
              currency: "BDT",
              status: isPublished ? "published" : "draft",
              thumbnail_url: finalThumbnailUrl,
              metadata: metadataPayload,
              is_featured: true,
            },
          ])
          .select()
          .single();

        if (insErr || !newProd) throw new Error(insErr?.message || "Failed to create product record.");
        productId = newProd.id;
      }

      // 2. Upload ZIP file package to private software-packages bucket if provided
      if (zipFile && productId) {
        const pkgExt = zipFile.name.split(".").pop() || "zip";
        const pkgPath = `releases/${cleanSlug}-${Date.now()}.${pkgExt}`;

        const pkgUpload = await insforge.storage.from("software-packages").upload(pkgPath, zipFile);
        if (pkgUpload.error) {
          console.warn("Package upload warning:", pkgUpload.error);
        }

        // Upsert software release linked to product
        await insforge.database.from("software_releases").insert([
          {
            product_id: productId,
            version_str: "v1.0.0",
            storage_path: pkgPath,
            changelog: "Product release package",
            file_size_bytes: zipFile.size,
            is_active: true,
          },
        ]);
      }

      setFeedback({
        type: "success",
        message: editingProductId
          ? `Product "${productTitle}" updated successfully!`
          : `Product "${productTitle}" created successfully!`,
      });

      resetForm();
      await loadProducts();
    } catch (err: any) {
      console.error("Save product error:", err);
      setFeedback({
        type: "error",
        message: err?.message || "Failed to save product.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle published / draft status
  const togglePublishStatus = async (prod: Product) => {
    setActionLoading(`toggle_${prod.id}`);
    try {
      const newStatus = prod.status === "published" ? "draft" : "published";
      const { error } = await insforge.database
        .from("products")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", prod.id);

      if (error) throw error;
      await loadProducts();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to update status." });
    } finally {
      setActionLoading(null);
    }
  };

  // Delete product
  const handleDeleteProduct = async (prod: Product) => {
    if (!window.confirm(`Are you sure you want to delete "${prod.title}"? This cannot be undone.`)) {
      return;
    }
    setActionLoading(`del_${prod.id}`);
    try {
      const { error } = await insforge.database.from("products").delete().eq("id", prod.id);
      if (error) throw error;
      setFeedback({ type: "success", message: `"${prod.title}" was deleted.` });
      await loadProducts();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to delete product." });
    } finally {
      setActionLoading(null);
    }
  };

  // Secure Admin download of ZIP file
  const handleAdminDownload = async (prod: Product) => {
    setActionLoading(`dl_${prod.id}`);
    try {
      const token = (await insforge.getHttpClient().getValidAccessToken()) || "";
      const res = await fetch(`/api/admin/download/${prod.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.downloadUrl) {
        throw new Error(data.error || "Failed to retrieve package file.");
      }

      // Download file directly
      window.open(data.downloadUrl, "_blank");
    } catch (err: any) {
      alert(err?.message || "Could not download file.");
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-400" />
          <h2 className="mt-4 text-xl font-bold text-white">Admin Access Restricted</h2>
          <p className="mt-2 text-sm text-zinc-400">
            This dashboard is reserved strictly for the Single Admin (barbarianjoy5@gmail.com).
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-all"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const embedPreviewUrl = getYouTubeEmbedUrl(youtubeUrl);
  const cleanWhatsAppPreview = whatsappNumber.replace(/[\s\+\-\(\)]/g, "").trim();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Single Admin Dashboard</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
            Software Product Management
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Logged in as <span className="text-zinc-200 font-mono">{user.email}</span>
          </p>
        </div>

        <button
          onClick={loadProducts}
          disabled={loadingData}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid: Form & List */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Product Form (5 cols) */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-sm">
            <div className="mb-6 flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-400" />
                <span>{editingProductId ? "Edit Software Product" : "Add New Software"}</span>
              </h2>
              {editingProductId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Product Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BEJOY Vector Pro"
                  value={productTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>

              {/* URL Slug */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  URL Slug (Auto-generated)
                </label>
                <input
                  type="text"
                  required
                  value={productSlug}
                  onChange={(e) => setProductSlug(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3.5 py-2 text-xs font-mono text-zinc-400 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Product Type (Free vs Premium) */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Product Type <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProductType("free")}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      productType === "free"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm"
                        : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <span>Free Software</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductType("premium")}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      productType === "premium"
                        ? "border-amber-500 bg-amber-500/10 text-amber-400 shadow-sm"
                        : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <span>Premium Software</span>
                  </button>
                </div>
              </div>

              {/* Price in BDT (Conditional for Premium only) */}
              {productType === "premium" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 animate-in fade-in duration-200">
                  <label className="block text-xs font-semibold text-amber-400 mb-1">
                    Price in BDT (৳) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required={productType === "premium"}
                    placeholder="e.g. 999"
                    value={productPriceBdt}
                    onChange={(e) => setProductPriceBdt(e.target.value)}
                    className="w-full rounded-lg border border-amber-500/40 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-400 focus:outline-none font-bold"
                  />
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Buyers will follow manual bKash/Nagad instructions or contact on WhatsApp.
                  </p>
                </div>
              )}

              {/* WhatsApp Number Field */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between">
                  <span>
                    WhatsApp Number{" "}
                    {productType === "premium" ? (
                      <span className="text-rose-400">*</span>
                    ) : (
                      <span className="text-zinc-500 font-normal">(Optional for Free)</span>
                    )}
                  </span>
                  {cleanWhatsAppPreview && /^[0-9]{7,15}$/.test(cleanWhatsAppPreview) && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                      <Check className="h-3 w-3" /> Valid (+{cleanWhatsAppPreview})
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MessageCircle className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type="tel"
                    required={productType === "premium"}
                    placeholder="e.g. 8801XXXXXXXXX"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none transition-colors font-mono"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {productType === "premium"
                    ? "Direct seller/owner WhatsApp number for this software (e.g. 8801XXXXXXXXX). Orders will be sent here."
                    : "Optional contact number for this specific software product."}
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Product Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Features, compatibility, installation steps..."
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Thumbnail Image Upload */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Product Thumbnail Image
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-3 text-xs font-medium text-zinc-300 hover:border-amber-500/60 hover:text-white transition-all">
                    <ImageIcon className="h-4 w-4 text-amber-400" />
                    <span>{imageFile ? imageFile.name : "Select Image (.png, .jpg, .webp)"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
                {(imagePreview || existingThumbnailUrl) && (
                  <div className="mt-2 relative w-full h-28 rounded-xl overflow-hidden border border-zinc-800 bg-black/40">
                    <img
                      src={imagePreview || existingThumbnailUrl || ""}
                      alt="Thumbnail Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* ZIP File Upload */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Software Package (.zip)
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-3 text-xs font-medium text-zinc-300 hover:border-amber-500/60 hover:text-white transition-all">
                  <FileArchive className="h-4 w-4 text-amber-400" />
                  <span className="truncate">
                    {zipFile ? `${zipFile.name} (${(zipFile.size / 1024 / 1024).toFixed(2)} MB)` : "Upload ZIP File"}
                  </span>
                  <input
                    type="file"
                    accept=".zip,.zxp,.rar,.7z"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Stored securely in private storage bucket.
                </p>
              </div>

              {/* Optional YouTube Video URL */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between">
                  <span>YouTube Demo URL (Optional)</span>
                  {embedPreviewUrl && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Valid Link
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Video className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>
                {embedPreviewUrl && (
                  <div className="mt-2 relative w-full aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black">
                    <iframe
                      src={embedPreviewUrl}
                      title="YouTube Preview"
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>

              {/* Publish / Unpublish Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <span className="text-xs font-medium text-zinc-300">Publish on Website</span>
                <button
                  type="button"
                  onClick={() => setIsPublished(!isPublished)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    isPublished ? "bg-amber-500" : "bg-zinc-800"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out ${
                      isPublished ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={actionLoading === "save_product"}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50 transition-all cursor-pointer"
              >
                {actionLoading === "save_product" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>{editingProductId ? "Update Product" : "Save and Publish Product"}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Product Inventory (7 cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Existing Products</span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                  {products.length}
                </span>
              </h2>
            </div>

            {products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-xs text-zinc-500">
                No products found in the database. Add your first software above.
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((prod) => {
                  const isFree = prod.product_type === "free";
                  const hasVideo = Boolean(prod.metadata?.youtube_url);
                  return (
                    <div
                      key={prod.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 hover:border-zinc-700/80 transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {prod.thumbnail_url ? (
                          <img
                            src={prod.thumbnail_url}
                            alt={prod.title}
                            className="h-12 w-12 rounded-lg object-cover border border-zinc-800 shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                            <Package className="h-5 w-5 text-zinc-600" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white truncate">{prod.title}</h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isFree
                                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                  : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {isFree ? "FREE" : `৳ ${(prod.price_cents / 100).toFixed(0)}`}
                            </span>
                            {hasVideo && (
                              <span className="rounded-full bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-red-400 flex items-center gap-0.5">
                                <Video className="h-2.5 w-2.5" /> Video
                              </span>
                            )}
                            {prod.metadata?.whatsapp_number && (
                              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 flex items-center gap-0.5 font-mono">
                                <MessageCircle className="h-2.5 w-2.5" /> +{prod.metadata.whatsapp_number}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-zinc-500 truncate">/{prod.slug}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {/* Publish/Unpublish toggle */}
                        <button
                          type="button"
                          onClick={() => togglePublishStatus(prod)}
                          title={prod.status === "published" ? "Unpublish Product" : "Publish Product"}
                          disabled={actionLoading === `toggle_${prod.id}`}
                          className={`rounded-lg p-2 text-xs transition-colors ${
                            prod.status === "published"
                              ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {prod.status === "published" ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>

                        {/* Admin Download ZIP */}
                        <button
                          type="button"
                          onClick={() => handleAdminDownload(prod)}
                          title="Download ZIP package (Admin copy)"
                          disabled={actionLoading === `dl_${prod.id}`}
                          className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:border-zinc-700 hover:text-amber-400 transition-colors"
                        >
                          {actionLoading === `dl_${prod.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </button>

                        {/* Public Link */}
                        <Link
                          href={`/products/${prod.slug}`}
                          target="_blank"
                          title="View on Website"
                          className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:border-zinc-700 hover:text-white transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => startEdit(prod)}
                          title="Edit Product"
                          className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:border-zinc-700 hover:text-white transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod)}
                          title="Delete Product"
                          disabled={actionLoading === `del_${prod.id}`}
                          className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-500 hover:border-rose-500/40 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
