"use client";

import React, { useEffect, useState } from "react";
import { useAuth, getClientAccessToken } from "../../lib/auth-context";
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
  Store,
  Clock,
  Users,
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { user, profile, isAdmin, isLoading: authLoading } = useAuth();
  const [adminTab, setAdminTab] = useState<"products" | "reviews" | "sellers">("products");
  const [loadingData, setLoadingData] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Products list
  const [products, setProducts] = useState<Product[]>([]);

  // Pending reviews state
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Sellers state
  const [sellers, setSellers] = useState<any[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(false);

  // Form state (existing admin product management)
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

  // Load pending product reviews
  const loadPendingReviews = async () => {
    setLoadingReviews(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/products/review", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setPendingProducts(data.products || []);
    } catch (err) {
      console.warn("Failed to load pending reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Load sellers
  const loadSellers = async () => {
    setLoadingSellers(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/sellers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSellers(data.vendors || []);
    } catch (err) {
      console.warn("Failed to load sellers:", err);
    } finally {
      setLoadingSellers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadProducts();
      loadPendingReviews();
      loadSellers();
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
    setAdminTab("products");
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

      const cleanWhatsAppNumber = whatsappNumber.replace(/[\s\+\-\(\)]/g, "").trim();

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

      const priceCents =
        productType === "free" ? 0 : Math.round(parseFloat(productPriceBdt || "0") * 100);

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

      if (zipFile && productId) {
        const pkgExt = zipFile.name.split(".").pop() || "zip";
        const pkgPath = `releases/${cleanSlug}-${Date.now()}.${pkgExt}`;

        const pkgUpload = await insforge.storage.from("software-packages").upload(pkgPath, zipFile);
        if (pkgUpload.error) {
          console.warn("Package upload warning:", pkgUpload.error);
        }

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
      await loadPendingReviews();
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
      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, status: newStatus } : p))
      );
      setFeedback({
        type: "success",
        message: `Product "${prod.title}" is now ${newStatus.toUpperCase()}`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to toggle status" });
    } finally {
      setActionLoading(null);
    }
  };

  // Delete product
  const handleDeleteProduct = async (prod: Product) => {
    if (!confirm(`Are you sure you want to permanently delete "${prod.title}"?`)) return;
    setActionLoading(`del_${prod.id}`);
    try {
      const { error } = await insforge.database.from("products").delete().eq("id", prod.id);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== prod.id));
      setFeedback({ type: "success", message: `Product "${prod.title}" deleted.` });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to delete product" });
    } finally {
      setActionLoading(null);
    }
  };

  // Admin download ZIP
  const handleAdminDownload = async (prod: Product) => {
    setActionLoading(`dl_${prod.id}`);
    try {
      const token = await getClientAccessToken();
      const res = await fetch(`/api/admin/download/${prod.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get download URL");
      window.location.href = data.downloadUrl;
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Admin download failed" });
    } finally {
      setActionLoading(null);
    }
  };

  // Admin Review Decision
  const handleReviewDecision = async (
    productId: string,
    decision: "approve" | "reject" | "changes_requested"
  ) => {
    let adminFeedback = "";
    if (decision !== "approve") {
      const feedbackInput = prompt("Enter optional feedback / reason for the seller:", "");
      if (feedbackInput === null) return;
      adminFeedback = feedbackInput;
    }

    setActionLoading(`review_${productId}`);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/products/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, decision, adminFeedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review action failed");

      setFeedback({ type: "success", message: data.message });
      await loadPendingReviews();
      await loadProducts();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to process review" });
    } finally {
      setActionLoading(null);
    }
  };

  // Admin Manage Seller
  const handleManageSeller = async (vendorId: string, action: "approve" | "reject" | "suspend") => {
    if (!confirm(`Are you sure you want to ${action} this seller?`)) return;

    setActionLoading(`seller_${vendorId}`);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/sellers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vendorId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seller action failed");

      setFeedback({ type: "success", message: data.message });
      await loadSellers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to update seller" });
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

  if (!isAdmin || !user) {
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Single Admin Control Panel</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
            Marketplace Management
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Logged in as <span className="text-zinc-200 font-mono">{user.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/seller/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700"
          >
            <Store className="h-3.5 w-3.5 text-amber-400" />
            <span>Open Seller View</span>
          </Link>
          <button
            onClick={() => {
              loadProducts();
              loadPendingReviews();
              loadSellers();
            }}
            disabled={loadingData || loadingReviews || loadingSellers}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 mb-8 pb-1">
        <button
          onClick={() => setAdminTab("products")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            adminTab === "products"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>All Products ({products.length})</span>
        </button>

        <button
          onClick={() => setAdminTab("reviews")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
            adminTab === "reviews"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Pending Reviews</span>
          {pendingProducts.length > 0 && (
            <span className="rounded-full bg-amber-500 text-zinc-950 font-black text-[10px] px-2 py-0.2">
              {pendingProducts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab("sellers")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
            adminTab === "sellers"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Sellers & Applications</span>
          {sellers.filter((s) => s.status === "pending").length > 0 && (
            <span className="rounded-full bg-emerald-500 text-zinc-950 font-black text-[10px] px-2 py-0.2">
              {sellers.filter((s) => s.status === "pending").length}
            </span>
          )}
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
          <span className="text-xs font-medium">{feedback.message}</span>
        </div>
      )}

      {/* TAB 2: PENDING PRODUCT REVIEWS */}
      {adminTab === "reviews" && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white">Pending Product Submissions</h2>
            <p className="text-xs text-zinc-400">
              Review seller software packages, verify pricing and contact details, then approve to publish live on the store.
            </p>
          </div>

          {loadingReviews ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : pendingProducts.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">All caught up!</h3>
              <p className="mt-1 text-xs text-zinc-400">There are no products currently waiting for admin review.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {pendingProducts.map((p) => {
                const isPremium = p.product_type === "premium";
                const priceBDT = p.price_cents ? (p.price_cents / 100).toLocaleString() : "0";
                const sellerName = p.vendor?.store_name || "Unknown Seller";
                const sellerSlug = p.vendor?.slug || "";

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-amber-500/30 bg-zinc-900/60 p-6 space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                      <div className="flex items-center gap-4">
                        {p.thumbnail_url ? (
                          <img
                            src={p.thumbnail_url}
                            alt={p.title}
                            className="h-16 w-16 rounded-xl object-cover bg-zinc-950 border border-zinc-800"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600">
                            <Package className="h-8 w-8" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white">{p.title}</h3>
                            <span className="rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                              Pending Review
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                            <span>
                              Submitted by:{" "}
                              <Link
                                href={`/seller/${sellerSlug}`}
                                target="_blank"
                                className="font-semibold text-amber-400 hover:underline inline-flex items-center gap-1"
                              >
                                <Store className="h-3 w-3" />
                                <span>{sellerName}</span>
                              </Link>
                            </span>
                            <span>&bull;</span>
                            <span className="font-mono text-zinc-500">/{p.slug}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xl font-black text-amber-400">
                          {isPremium ? `৳ ${priceBDT} BDT` : "FREE"}
                        </span>
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                          {p.product_type}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-300 whitespace-pre-line bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Description</span>
                      {p.description || "No description provided."}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 text-xs">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">WhatsApp Contact</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {p.metadata?.whatsapp_number || "None"}
                        </span>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">YouTube Demo</span>
                        <span className="text-zinc-300 truncate block">
                          {p.metadata?.youtube_url ? (
                            <a
                              href={p.metadata.youtube_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-400 hover:underline flex items-center gap-1"
                            >
                              <span>Watch Demo Video</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "No video"
                          )}
                        </span>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">Package Attached</span>
                        <span className="text-zinc-300">
                          {p.software_releases && p.software_releases.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleAdminDownload(p)}
                              className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Download className="h-3 w-3" />
                              <span>Download & Inspect ZIP</span>
                            </button>
                          ) : (
                            "No package file"
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => handleReviewDecision(p.id, "changes_requested")}
                        disabled={actionLoading === `review_${p.id}`}
                        className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white"
                      >
                        Request Changes / Draft
                      </button>
                      <button
                        onClick={() => handleReviewDecision(p.id, "approve")}
                        disabled={actionLoading === `review_${p.id}`}
                        className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                      >
                        {actionLoading === `review_${p.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Approve & Publish</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SELLERS & APPLICATIONS */}
      {adminTab === "sellers" && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white">Sellers & Creator Accounts</h2>
            <p className="text-xs text-zinc-400">
              Review seller applications, grant creator privileges, or suspend non-compliant seller stores.
            </p>
          </div>

          {loadingSellers ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : sellers.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
              <Users className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No sellers registered</h3>
              <p className="mt-1 text-xs text-zinc-400">No seller applications have been submitted yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sellers.map((s) => {
                const isPending = s.status === "pending";
                const isActive = s.status === "active";
                const isSuspended = s.status === "suspended";

                return (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white">{s.store_name}</h4>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : isPending
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1">
                        <span className="font-mono text-amber-400">@{s.slug}</span>
                        <span>&bull;</span>
                        <span>{s.user?.email || "Unknown user"}</span>
                        <span>&bull;</span>
                        <span className="text-zinc-500">
                          Applied: {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {s.bio && <p className="mt-2 text-xs text-zinc-300 italic">"{s.bio}"</p>}
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-2">
                        <span>Total Products: {s.stats?.total || 0}</span>
                        <span>&bull;</span>
                        <span className="text-emerald-400">Live: {s.stats?.published || 0}</span>
                        <span>&bull;</span>
                        <span className="text-amber-400">Pending: {s.stats?.pending || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isActive && (
                        <Link
                          href={`/seller/${s.slug}`}
                          target="_blank"
                          className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Profile</span>
                        </Link>
                      )}

                      {isPending && (
                        <button
                          onClick={() => handleManageSeller(s.id, "approve")}
                          disabled={actionLoading === `seller_${s.id}`}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve Seller</span>
                        </button>
                      )}

                      {isActive && (
                        <button
                          onClick={() => handleManageSeller(s.id, "suspend")}
                          disabled={actionLoading === `seller_${s.id}`}
                          className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                        >
                          <span>Suspend</span>
                        </button>
                      )}

                      {isSuspended && (
                        <button
                          onClick={() => handleManageSeller(s.id, "approve")}
                          disabled={actionLoading === `seller_${s.id}`}
                          className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                        >
                          <span>Re-activate</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: ALL PRODUCTS & UPLOAD (EXISTING FEATURE PRESERVED) */}
      {adminTab === "products" && (
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Left Column: Product Form */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {editingProductId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </div>
                  <h2 className="text-base font-bold text-white">
                    {editingProductId ? "Edit Product" : "Upload New Product"}
                  </h2>
                </div>
                {editingProductId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-zinc-400 hover:text-white border border-zinc-800 rounded-lg px-2.5 py-1"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitProduct} className="space-y-4 text-xs">
                {/* Product Name */}
                <div>
                  <label className="block font-bold uppercase text-zinc-400 mb-1.5">
                    Product Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={productTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. BEJOY BROWSER V1"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block font-bold uppercase text-zinc-400 mb-1.5">
                    URL Slug <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 font-mono text-zinc-400">
                    <span className="text-zinc-500 select-none">/products/</span>
                    <input
                      type="text"
                      required
                      value={productSlug}
                      onChange={(e) => setProductSlug(e.target.value)}
                      placeholder="bejoy-browser-v1"
                      className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none ml-0.5"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block font-bold uppercase text-zinc-400 mb-1.5">
                    Description <span className="text-zinc-500 font-normal">(Features & info)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    placeholder="Describe the software package..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Product Type & Price */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-zinc-400 mb-1.5">Product Type</label>
                    <select
                      value={productType}
                      onChange={(e) => setProductType(e.target.value as any)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="free">Free Download</option>
                      <option value="premium">Premium Software</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-zinc-400 mb-1.5">
                      Price in BDT (৳) {productType === "premium" && <span className="text-rose-400">*</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={productType === "free"}
                      value={productType === "free" ? "0" : productPriceBdt}
                      onChange={(e) => setProductPriceBdt(e.target.value)}
                      placeholder="999"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-100 disabled:opacity-40 focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Product-Specific WhatsApp Number */}
                <div>
                  <label className="block font-bold uppercase text-zinc-400 mb-1.5">
                    WhatsApp Number {productType === "premium" ? <span className="text-rose-400">*</span> : <span className="text-zinc-500 font-normal">(Optional for Free)</span>}
                  </label>
                  <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-100">
                    <MessageCircle className="h-4 w-4 text-emerald-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      required={productType === "premium"}
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="e.g. 8801876603607"
                      className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    International format (7-15 digits without + or spaces).
                  </p>
                </div>

                {/* YouTube Video URL */}
                <div>
                  <label className="block font-bold uppercase text-zinc-400 mb-1.5">
                    YouTube Demo URL <span className="text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-100">
                    <Video className="h-4 w-4 text-red-500 mr-2 shrink-0" />
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Live YouTube Preview */}
                {embedPreviewUrl && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                    <span className="text-[10px] text-zinc-500 block mb-1">Live Video Preview:</span>
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                      <iframe
                        src={embedPreviewUrl}
                        title="YouTube Preview"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  </div>
                )}

                {/* Thumbnail Image */}
                <div>
                  <label className="block font-bold uppercase text-zinc-400 mb-1.5">
                    Product Thumbnail <span className="text-zinc-500 font-normal">(Public Image)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="block w-full text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-xs file:font-bold file:text-zinc-200 hover:file:bg-zinc-700"
                  />
                  {(imagePreview || existingThumbnailUrl) && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={imagePreview || existingThumbnailUrl || ""}
                        alt="Preview"
                        className="h-14 w-14 rounded-lg object-cover border border-zinc-800"
                      />
                      <span className="text-[11px] text-zinc-500">Thumbnail selected</span>
                    </div>
                  )}
                </div>

                {/* Software ZIP */}
                <div>
                  <label className="block font-bold uppercase text-zinc-400 mb-1.5">
                    Software ZIP Package <span className="text-zinc-500 font-normal">(Private Storage)</span>
                  </label>
                  <input
                    type="file"
                    accept=".zip,.zxp,.tar.gz,.rar"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="block w-full text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-xs file:font-bold file:text-zinc-200 hover:file:bg-zinc-700"
                  />
                </div>

                {/* Publish Toggle */}
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div>
                    <span className="font-bold text-zinc-200 block">Publish on Store</span>
                    <span className="text-[11px] text-zinc-500">
                      {isPublished ? "Visible to customers immediately" : "Saved as draft only"}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={actionLoading === "save_product"}
                  className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === "save_product" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span>{editingProductId ? "Update Product" : "Create & Upload Product"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Existing Products Table */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">All Store Products ({products.length})</h2>
                <p className="text-xs text-zinc-400">All products currently saved in the database.</p>
              </div>
            </div>

            {loadingData ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
                <FileArchive className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">No products yet</h3>
                <p className="mt-1 text-xs text-zinc-400">Use the form on the left to upload your first software product.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((prod) => {
                  const isProdPublished = prod.status === "published";
                  const isFree = prod.product_type === "free";
                  const priceStr = prod.price_cents ? (prod.price_cents / 100).toLocaleString() : "0";

                  return (
                    <div
                      key={prod.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center gap-3.5">
                        {prod.thumbnail_url ? (
                          <img
                            src={prod.thumbnail_url}
                            alt={prod.title}
                            className="h-14 w-14 rounded-xl object-cover bg-zinc-950 border border-zinc-800 shrink-0"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                            <Package className="h-6 w-6" />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{prod.title}</h4>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                isProdPublished
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                  : "bg-zinc-700/20 text-zinc-400 border border-zinc-700/40"
                              }`}
                            >
                              {prod.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 mt-1">
                            <span className="font-mono text-zinc-500">/{prod.slug}</span>
                            <span>&bull;</span>
                            <span className="capitalize font-semibold text-zinc-300">
                              {isFree ? "Free Download" : `৳ ${priceStr} BDT`}
                            </span>
                            {prod.metadata?.whatsapp_number && (
                              <>
                                <span>&bull;</span>
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <MessageCircle className="h-3 w-3" />
                                  <span>{prod.metadata.whatsapp_number}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {/* Publish toggle */}
                        <button
                          type="button"
                          onClick={() => togglePublishStatus(prod)}
                          title={isProdPublished ? "Unpublish (hide from storefront)" : "Publish (show on storefront)"}
                          disabled={actionLoading === `toggle_${prod.id}`}
                          className={`rounded-lg border p-2 text-xs transition-colors ${
                            isProdPublished
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                          }`}
                        >
                          {actionLoading === `toggle_${prod.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isProdPublished ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>

                        {/* Admin ZIP Download */}
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
      )}
    </div>
  );
}
