"use client";

import React, { useEffect, useState } from "react";
import { useAuth, getClientAccessToken } from "../../lib/auth-context";
import { insforge } from "../../lib/insforge";
import { Product, formatPrice, HomepageAnimationConfig, SiteBrandingConfig, HeroContentConfig } from "../../lib/types";
import { DEFAULT_HERO_CONTENT, HERO_LIMITS, normalizeHeroContent } from "../../lib/hero-content";
import { getYouTubeVideoId, getYouTubeEmbedUrl } from "../../lib/youtube";
import TypewriterText from "../../components/TypewriterText";
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
  Sparkles,
  Palette,
  Type,
  Save,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { user, profile, isAdmin, isLoading: authLoading } = useAuth();
  const [adminTab, setAdminTab] = useState<"products" | "reviews" | "sellers" | "animation" | "hero" | "branding">("products");
  const [loadingData, setLoadingData] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Animation settings state
  const [animationConfig, setAnimationConfig] = useState<HomepageAnimationConfig | null>(null);
  const [animationTableExists, setAnimationTableExists] = useState(true);
  const [loadingAnimation, setLoadingAnimation] = useState(false);
  const [animVideoFile, setAnimVideoFile] = useState<File | null>(null);
  const [animVideoPreview, setAnimVideoPreview] = useState<string | null>(null);
  const [animUploadProgress, setAnimUploadProgress] = useState<string | null>(null);

  // Site Branding state
  const [brandingConfig, setBrandingConfig] = useState<SiteBrandingConfig | null>(null);
  const [loadingBranding, setLoadingBranding] = useState(false);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [wordmarkFile, setWordmarkFile] = useState<File | null>(null);
  const [wordmarkPreview, setWordmarkPreview] = useState<string | null>(null);

  // Hero Content state (heroConfig = saved, heroDraft = editor)
  const [heroConfig, setHeroConfig] = useState<HeroContentConfig | null>(null);
  const [heroDraft, setHeroDraft] = useState<HeroContentConfig>(DEFAULT_HERO_CONTENT);
  const [loadingHero, setLoadingHero] = useState(false);

  // Products list
  const [products, setProducts] = useState<Product[]>([]);

  // Pending reviews state
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewVideoPreviews, setReviewVideoPreviews] = useState<Record<string, string>>({});

  // Sellers state
  const [sellers, setSellers] = useState<any[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(false);

  // Form state (existing admin product management)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productType, setProductType] = useState<"free" | "premium">("free");
  const [productCurrency, setProductCurrency] = useState<"BDT" | "USD">("BDT");
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
      if (res.ok) {
        const prods = data.products || [];
        setPendingProducts(prods);

        // Fetch signed URLs for products with pending_video_path
        prods.forEach(async (p: any) => {
          if (p.metadata?.pending_video_path) {
            try {
              const vRes = await fetch(`/api/admin/video-preview?productId=${p.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const vData = await vRes.json();
              if (vRes.ok && vData.previewUrl) {
                setReviewVideoPreviews((prev) => ({ ...prev, [p.id]: vData.previewUrl }));
              }
            } catch (err) {
              console.warn("Failed to load video preview for", p.id, err);
            }
          }
        });
      }
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

  // Load animation settings
  const loadAnimationSettings = async () => {
    setLoadingAnimation(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/homepage/animation", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAnimationConfig(data.animation);
        setAnimationTableExists(data.tableExists !== false);
      }
    } catch (err) {
      console.warn("Failed to load animation settings:", err);
    } finally {
      setLoadingAnimation(false);
    }
  };

  const handleToggleAnimation = async (enabled: boolean) => {
    setActionLoading("toggle_animation");
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/homepage/animation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "toggle", enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle animation");
      setAnimationConfig(data.animation);
      setFeedback({
        type: "success",
        message: `Homepage animation ${enabled ? "enabled" : "disabled"} successfully!`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to toggle animation" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUploadAnimation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animVideoFile) {
      setFeedback({ type: "error", message: "Please select an MP4 or WebM video file." });
      return;
    }
    setActionLoading("upload_animation");
    setAnimUploadProgress("Uploading animation video (this may take a few moments)...");
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const formData = new FormData();
      formData.append("video", animVideoFile);

      const res = await fetch("/api/admin/homepage/animation", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload animation video");
      setAnimationConfig(data.animation);
      setAnimVideoFile(null);
      setAnimVideoPreview(null);
      setFeedback({
        type: "success",
        message: "Homepage animation video uploaded and enabled successfully!",
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to upload animation" });
    } finally {
      setActionLoading(null);
      setAnimUploadProgress(null);
    }
  };

  const handleRemoveAnimation = async () => {
    if (!confirm("Are you sure you want to remove the homepage animation video? This will delete the video file and disable the animation.")) {
      return;
    }
    setActionLoading("remove_animation");
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/homepage/animation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "remove" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove animation");
      setAnimationConfig(data.animation);
      setAnimVideoFile(null);
      setAnimVideoPreview(null);
      setFeedback({
        type: "success",
        message: "Homepage animation removed successfully.",
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to remove animation" });
    } finally {
      setActionLoading(null);
    }
  };

  // Load branding settings
  const loadBrandingSettings = async () => {
    setLoadingBranding(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/branding", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.branding) {
        setBrandingConfig(data.branding);
      }
    } catch (err) {
      console.warn("Failed to load branding settings:", err);
    } finally {
      setLoadingBranding(false);
    }
  };

  const handleUploadIcon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iconFile) return;

    setActionLoading("upload_icon");
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const formData = new FormData();
      formData.append("target", "icon");
      formData.append("file", iconFile);

      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload square icon");

      setBrandingConfig(data.branding);
      setIconFile(null);
      setIconPreview(null);
      setFeedback({ type: "success", message: data.message || "Square icon updated successfully!" });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to upload icon" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveIcon = async () => {
    if (!confirm("Are you sure you want to remove the custom square icon? The header will revert to the default 'B' icon.")) return;

    setActionLoading("remove_icon");
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "remove_icon" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove icon");

      setBrandingConfig(data.branding);
      setIconFile(null);
      setIconPreview(null);
      setFeedback({ type: "success", message: data.message || "Square icon removed." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to remove icon" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUploadWordmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordmarkFile) return;

    setActionLoading("upload_wordmark");
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const formData = new FormData();
      formData.append("target", "wordmark");
      formData.append("file", wordmarkFile);

      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload site wordmark");

      setBrandingConfig(data.branding);
      setWordmarkFile(null);
      setWordmarkPreview(null);
      setFeedback({ type: "success", message: data.message || "Site wordmark updated successfully!" });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to upload wordmark" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveWordmark = async () => {
    if (!confirm("Are you sure you want to remove the custom site wordmark? The header will revert to the default 'BEEEJOY' text.")) return;

    setActionLoading("remove_wordmark");
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "remove_wordmark" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove wordmark");

      setBrandingConfig(data.branding);
      setWordmarkFile(null);
      setWordmarkPreview(null);
      setFeedback({ type: "success", message: data.message || "Site wordmark removed." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to remove wordmark" });
    } finally {
      setActionLoading(null);
    }
  };

  // Load hero content settings
  const loadHeroContent = async () => {
    setLoadingHero(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/hero-content", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.hero) {
        const hero = normalizeHeroContent(data.hero);
        setHeroConfig(hero);
        setHeroDraft(hero);
      }
    } catch (err) {
      console.warn("Failed to load hero content:", err);
    } finally {
      setLoadingHero(false);
    }
  };

  const updateHeroDraft = (patch: Partial<HeroContentConfig>) => {
    setHeroDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateHeroPhrase = (index: number, value: string) => {
    setHeroDraft((prev) =>
      prev
        ? {
            ...prev,
            phrases: prev.phrases.map((phrase, i) => (i === index ? value : phrase)),
          }
        : prev
    );
  };

  const addHeroPhrase = () => {
    setHeroDraft((prev) =>
      prev && prev.phrases.length < HERO_LIMITS.phrases.max
        ? { ...prev, phrases: [...prev.phrases, ""] }
        : prev
    );
  };

  const removeHeroPhrase = (index: number) => {
    setHeroDraft((prev) =>
      prev && prev.phrases.length > HERO_LIMITS.phrases.min
        ? { ...prev, phrases: prev.phrases.filter((_, i) => i !== index) }
        : prev
    );
  };

  const moveHeroPhrase = (index: number, direction: -1 | 1) => {
    setHeroDraft((prev) => {
      if (!prev) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.phrases.length) return prev;
      const phrases = [...prev.phrases];
      [phrases[index], phrases[target]] = [phrases[target], phrases[index]];
      return { ...prev, phrases };
    });
  };

  const resetHeroDraft = () => {
    setHeroDraft(heroConfig ? { ...heroConfig } : normalizeHeroContent(DEFAULT_HERO_CONTENT));
  };

  const applyDefaultHero = () => {
    setHeroDraft(normalizeHeroContent(DEFAULT_HERO_CONTENT));
  };

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroDraft) return;

    setActionLoading("save_hero");
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/hero-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hero: heroDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save hero content");

      const hero = normalizeHeroContent(data.hero);
      setHeroConfig(hero);
      setHeroDraft(hero);
      setFeedback({
        type: "success",
        message: data.message || "Hero content saved successfully!",
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to save hero content" });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadProducts();
      loadPendingReviews();
      loadSellers();
      loadAnimationSettings();
      loadBrandingSettings();
      loadHeroContent();
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
    setProductCurrency("BDT");
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
    setProductCurrency(prod.currency === "USD" ? "USD" : "BDT");
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
            currency: productCurrency,
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
              currency: productCurrency,
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

  // Hero Content editor derivations
  const heroComparable = (config: HeroContentConfig) =>
    JSON.stringify({
      heading: config.heading,
      description: config.description,
      phrases: config.phrases,
      typewriter_enabled: config.typewriter_enabled,
      cursor_enabled: config.cursor_enabled,
      typing_speed_ms: config.typing_speed_ms,
      deleting_speed_ms: config.deleting_speed_ms,
      pause_ms: config.pause_ms,
    });
  const heroDirty = heroComparable(heroDraft) !== heroComparable(heroConfig ?? DEFAULT_HERO_CONTENT);
  const previewPhrases = (() => {
    const list = heroDraft.phrases.map((phrase) => phrase.trim()).filter(Boolean);
    return list.length ? list : DEFAULT_HERO_CONTENT.phrases;
  })();

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
              loadAnimationSettings();
              loadBrandingSettings();
              loadHeroContent();
            }}
            disabled={loadingData || loadingReviews || loadingSellers || loadingAnimation || loadingBranding || loadingHero}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingData || loadingAnimation || loadingBranding || loadingHero ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 mb-8 pb-1 overflow-x-auto">
        <button
          onClick={() => setAdminTab("products")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative shrink-0 ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative shrink-0 ${
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

        <button
          onClick={() => setAdminTab("animation")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            adminTab === "animation"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Homepage Animation</span>
          {animationConfig?.enabled && animationConfig?.video_url && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="Active on Homepage" />
          )}
        </button>

        <button
          onClick={() => setAdminTab("hero")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            adminTab === "hero"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Type className="h-4 w-4" />
          <span>Hero Content</span>
          {heroConfig?.typewriter_enabled && heroConfig?.phrases?.length > 0 && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="Typewriter Active" />
          )}
        </button>

        <button
          onClick={() => setAdminTab("branding")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            adminTab === "branding"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Palette className="h-4 w-4" />
          <span>Site Branding</span>
          {(brandingConfig?.icon_url || brandingConfig?.wordmark_url) && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="Custom Branding Active" />
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
                const priceFormatted = formatPrice(p.price_cents || 0, p.currency || "BDT");
                const currencyLabel = p.currency || "BDT";
                const sellerName = p.vendor?.store_name || "Unknown Seller";
                const sellerSlug = p.vendor?.slug || "";
                const videoPreviewUrl = reviewVideoPreviews[p.id];

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
                          {isPremium ? `${priceFormatted} ${currencyLabel}` : "FREE"}
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
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">Demo Video</span>
                        <span className="text-zinc-300 truncate block">
                          {videoPreviewUrl ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              <span>Uploaded Video (Ready to inspect below)</span>
                            </span>
                          ) : p.metadata?.youtube_url ? (
                            <a
                              href={p.metadata.youtube_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-400 hover:underline flex items-center gap-1"
                            >
                              <span>Watch YouTube Video</span>
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

                    {/* Video Player Inspection (if uploaded video preview is available) */}
                    {videoPreviewUrl && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5 text-amber-400" />
                          <span>Private Staged Video Preview (Admin Protected)</span>
                        </span>
                        <div className="aspect-video max-w-lg rounded-xl overflow-hidden border border-zinc-800 bg-black">
                          <video
                            src={videoPreviewUrl}
                            controls
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    )}

                    {/* YouTube Embed Inspection */}
                    {!videoPreviewUrl && p.metadata?.youtube_url && getYouTubeEmbedUrl(p.metadata.youtube_url) && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5 text-rose-400" />
                          <span>YouTube Demo Preview</span>
                        </span>
                        <div className="aspect-video max-w-lg rounded-xl overflow-hidden border border-zinc-800">
                          <iframe
                            src={getYouTubeEmbedUrl(p.metadata.youtube_url) || ""}
                            title="YouTube Preview"
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          />
                        </div>
                      </div>
                    )}

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

      {/* TAB 4: HOMEPAGE ANIMATION */}
      {adminTab === "animation" && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <span>Homepage Hero Animation</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Manage the looping video animation displayed on the right side of the homepage hero section.
            </p>
          </div>

          {/* Database Notice if table not created yet */}
          {!animationTableExists && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-300">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm text-white">Database Migration Required</p>
                  <p className="text-zinc-300">
                    The <code className="text-amber-400 font-mono">site_settings</code> table is not yet created in the database. Please review and apply the SQL migration to persist animations.
                  </p>
                </div>
              </div>
            </div>
          )}

          {loadingAnimation ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Active Animation & Status */}
              <div className="lg:col-span-7 space-y-6">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Current Hero Animation</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {animationConfig?.video_url
                          ? "Video is configured in storage"
                          : "No animation video currently active"}
                      </p>
                    </div>

                    {/* Status Badge */}
                    {animationConfig?.video_url ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                          animationConfig.enabled
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            animationConfig.enabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                          }`}
                        />
                        <span>{animationConfig.enabled ? "Live on Homepage" : "Disabled (Hidden)"}</span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-800/80 border border-zinc-700/80 px-3 py-1 text-xs font-semibold text-zinc-400">
                        Not Configured
                      </span>
                    )}
                  </div>

                  {/* Video Player Preview */}
                  {animationConfig?.video_url ? (
                    <div className="space-y-3">
                      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-xl">
                        <video
                          src={animationConfig.video_url}
                          controls
                          loop
                          muted
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* Controls Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleAnimation(!animationConfig.enabled)}
                            disabled={actionLoading === "toggle_animation"}
                            className={`rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition-all ${
                              animationConfig.enabled
                                ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                            }`}
                          >
                            {actionLoading === "toggle_animation" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : animationConfig.enabled ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                            <span>{animationConfig.enabled ? "Disable Animation" : "Enable Animation"}</span>
                          </button>

                          <Link
                            href="/"
                            target="_blank"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                          >
                            <span>Preview Homepage</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>

                        <button
                          type="button"
                          onClick={handleRemoveAnimation}
                          disabled={actionLoading === "remove_animation"}
                          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
                        >
                          {actionLoading === "remove_animation" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>Remove Video</span>
                        </button>
                      </div>

                      {animationConfig.updated_at && (
                        <p className="text-[11px] text-zinc-500 font-mono">
                          Last updated: {new Date(animationConfig.updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-12 text-center">
                      <Video className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-zinc-300">No Animation Configured</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Upload an MP4 or WebM video to display on the right side of the homepage hero.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Upload / Replace Form */}
              <div className="lg:col-span-5">
                <form
                  onSubmit={handleUploadAnimation}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5"
                >
                  <div className="border-b border-zinc-800/80 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Upload className="h-4 w-4 text-amber-400" />
                      <span>{animationConfig?.video_url ? "Replace Animation Video" : "Upload Animation Video"}</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      MP4 or WebM format &bull; Max 50MB
                    </p>
                  </div>

                  {/* File Dropzone / Selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                      Select Video File
                    </label>
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!["video/mp4", "video/webm"].includes(file.type)) {
                            setFeedback({
                              type: "error",
                              message: "Please choose an MP4 or WebM video file.",
                            });
                            return;
                          }
                          if (file.size > 50 * 1024 * 1024) {
                            setFeedback({
                              type: "error",
                              message: "Video file exceeds the 50MB limit.",
                            });
                            return;
                          }
                          setAnimVideoFile(file);
                          setAnimVideoPreview(URL.createObjectURL(file));
                          setFeedback(null);
                        }
                      }}
                      className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-zinc-800 file:text-xs file:font-bold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                    />
                  </div>

                  {/* Staged file preview */}
                  {animVideoPreview && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-zinc-400 block">
                        New Video Selection: {animVideoFile?.name} ({(animVideoFile!.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-amber-500/30 bg-black">
                        <video src={animVideoPreview} controls className="w-full h-full object-contain" />
                      </div>
                    </div>
                  )}

                  {/* Progress Indicator */}
                  {animUploadProgress && (
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{animUploadProgress}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!animVideoFile || actionLoading === "upload_animation"}
                    className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading === "upload_animation" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Uploading Video...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>{animationConfig?.video_url ? "Upload & Replace Animation" : "Upload & Enable Animation"}</span>
                      </>
                    )}
                  </button>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-[11px] text-zinc-400 space-y-1.5">
                    <p className="font-semibold text-zinc-300">Playback specifications:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-zinc-500">
                      <li>Autoplay, muted, infinite loop, inline</li>
                      <li>No player controls or borders displayed</li>
                      <li>Seamless dark background vignette</li>
                      <li>Square / high-aspect ratio works best</li>
                    </ul>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: HERO CONTENT & TYPEWRITER */}
      {adminTab === "hero" && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Type className="h-5 w-5 text-amber-400" />
              <span>Hero Content & Typewriter Animation</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Edit the homepage hero heading and description, then manage the rotating typewriter phrases. Saved changes appear on the homepage immediately.
            </p>
          </div>

          {loadingHero && !heroConfig ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Editor */}
              <form onSubmit={handleSaveHero} className="lg:col-span-7 space-y-6">
                {/* Static copy */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
                  <h3 className="text-sm font-bold text-white">Hero Text</h3>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                      Main Heading
                    </label>
                    <input
                      type="text"
                      value={heroDraft.heading}
                      maxLength={HERO_LIMITS.heading.max}
                      onChange={(e) => updateHeroDraft({ heading: e.target.value })}
                      placeholder="Fast, Reliable Software Downloads by"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    />
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      {heroDraft.heading.length}/{HERO_LIMITS.heading.max} characters &bull; always visible above the animated line
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                      Hero Description
                    </label>
                    <textarea
                      rows={4}
                      value={heroDraft.description}
                      maxLength={HERO_LIMITS.description.max}
                      onChange={(e) => updateHeroDraft({ description: e.target.value })}
                      placeholder="Short supporting paragraph shown under the heading"
                      className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm leading-6 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    />
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      {heroDraft.description.length}/{HERO_LIMITS.description.max} characters
                    </p>
                  </div>
                </div>

                {/* Phrases */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">Animated Phrases</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Typed in order, then looped. {HERO_LIMITS.phrases.min}&ndash;{HERO_LIMITS.phrases.max} phrases, up to {HERO_LIMITS.phrases.length} characters each.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addHeroPhrase}
                      disabled={heroDraft.phrases.length >= HERO_LIMITS.phrases.max}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Phrase</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {heroDraft.phrases.map((phrase, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-5 shrink-0 text-center text-[11px] font-mono text-zinc-500">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={phrase}
                          maxLength={HERO_LIMITS.phrases.length}
                          onChange={(e) => updateHeroPhrase(index, e.target.value)}
                          placeholder="Phrase text"
                          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => moveHeroPhrase(index, -1)}
                          disabled={index === 0}
                          title="Move up"
                          aria-label={`Move phrase ${index + 1} up`}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-30 transition-all"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveHeroPhrase(index, 1)}
                          disabled={index === heroDraft.phrases.length - 1}
                          title="Move down"
                          aria-label={`Move phrase ${index + 1} down`}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-30 transition-all"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeHeroPhrase(index)}
                          disabled={heroDraft.phrases.length <= HERO_LIMITS.phrases.min}
                          title={heroDraft.phrases.length <= HERO_LIMITS.phrases.min ? "At least one phrase is required" : "Delete phrase"}
                          aria-label={`Delete phrase ${index + 1}`}
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Behaviour */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
                  <div className="border-b border-zinc-800/80 pb-3">
                    <h3 className="text-sm font-bold text-white">Animation Behaviour</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Visitors with reduced-motion preferences always see the first phrase without animation.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-200">Typewriter Animation</p>
                      <p className="text-[11px] text-zinc-500">Types each phrase character by character.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={heroDraft.typewriter_enabled}
                      aria-label="Toggle typewriter animation"
                      onClick={() => updateHeroDraft({ typewriter_enabled: !heroDraft.typewriter_enabled })}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        heroDraft.typewriter_enabled ? "bg-amber-500" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                          heroDraft.typewriter_enabled ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-200">Blinking Cursor</p>
                      <p className="text-[11px] text-zinc-500">Vertical caret beside the typing text.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={heroDraft.cursor_enabled}
                      aria-label="Toggle blinking cursor"
                      onClick={() => updateHeroDraft({ cursor_enabled: !heroDraft.cursor_enabled })}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        heroDraft.cursor_enabled ? "bg-amber-500" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                          heroDraft.cursor_enabled ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-300">Typing Speed</label>
                      <span className="text-[11px] font-mono text-amber-400">{heroDraft.typing_speed_ms} ms / character</span>
                    </div>
                    <input
                      type="range"
                      min={HERO_LIMITS.typingSpeedMs.min}
                      max={HERO_LIMITS.typingSpeedMs.max}
                      step={5}
                      value={heroDraft.typing_speed_ms}
                      onChange={(e) => updateHeroDraft({ typing_speed_ms: Number(e.target.value) })}
                      className="mt-2 w-full accent-amber-500"
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">Lower values type faster.</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-300">Deleting Speed</label>
                      <span className="text-[11px] font-mono text-amber-400">{heroDraft.deleting_speed_ms} ms / character</span>
                    </div>
                    <input
                      type="range"
                      min={HERO_LIMITS.deletingSpeedMs.min}
                      max={HERO_LIMITS.deletingSpeedMs.max}
                      step={5}
                      value={heroDraft.deleting_speed_ms}
                      onChange={(e) => updateHeroDraft({ deleting_speed_ms: Number(e.target.value) })}
                      className="mt-2 w-full accent-amber-500"
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">Lower values delete faster.</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-300">Hold Time (after each phrase)</label>
                      <span className="text-[11px] font-mono text-amber-400">{(heroDraft.pause_ms / 1000).toFixed(1)} s</span>
                    </div>
                    <input
                      type="range"
                      min={HERO_LIMITS.pauseMs.min}
                      max={HERO_LIMITS.pauseMs.max}
                      step={100}
                      value={heroDraft.pause_ms}
                      onChange={(e) => updateHeroDraft({ pause_ms: Number(e.target.value) })}
                      className="mt-2 w-full accent-amber-500"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[11px]">
                    {heroDirty ? (
                      <span className="font-semibold text-amber-400">Unsaved changes</span>
                    ) : (
                      <span className="font-semibold text-emerald-400">All changes saved</span>
                    )}
                    {heroConfig?.updated_at && (
                      <span className="mt-0.5 block font-mono text-zinc-500">
                        Last saved: {new Date(heroConfig.updated_at).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={applyDefaultHero}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white transition-all"
                    >
                      Load Defaults
                    </button>
                    <button
                      type="button"
                      onClick={resetHeroDraft}
                      disabled={!heroDirty}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white disabled:opacity-40 transition-all"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading === "save_hero"}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50 transition-all"
                    >
                      {actionLoading === "save_hero" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      <span>Save Hero Content</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Right Column: Live Preview */}
              <div className="lg:col-span-5">
                <div className="space-y-4 lg:sticky lg:top-24 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">Live Preview</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">Uses your unsaved draft values.</p>
                    </div>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Hero
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[9px] font-semibold text-amber-400">
                      <Sparkles className="h-2.5 w-2.5" />
                      <span className="truncate">Official BEEEJOY Software Catalog &amp; Creator Marketplace</span>
                    </div>

                    <h4 className="mt-4 font-extrabold tracking-tight text-white text-lg leading-tight">
                      <span className="block">
                        {heroDraft.heading.trim() || "Your main heading"}
                      </span>
                      <span className="mt-1 block text-amber-400">
                        <TypewriterText
                          phrases={previewPhrases}
                          enabled={heroDraft.typewriter_enabled}
                          cursor={heroDraft.cursor_enabled}
                          typingSpeed={heroDraft.typing_speed_ms}
                          deletingSpeed={heroDraft.deleting_speed_ms}
                          pauseDuration={heroDraft.pause_ms}
                        />
                      </span>
                    </h4>

                    <p className="mt-3 text-[11px] leading-5 text-zinc-400">
                      {heroDraft.description.trim() || "Your hero description will appear here."}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-xl bg-zinc-800 px-3 py-1.5 text-[10px] font-bold text-zinc-400">Primary CTA</span>
                      <span className="rounded-xl border border-zinc-700 px-3 py-1.5 text-[10px] font-bold text-zinc-400">Secondary CTA</span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 text-[11px] text-zinc-500">
                    <li>&bull; The heading stays fixed while only the amber line animates.</li>
                    <li>&bull; Space is reserved for the longest phrase, so the layout never jumps.</li>
                    <li>&bull; Reduced-motion visitors see the first phrase without typing.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SITE BRANDING */}
      {adminTab === "branding" && (
        <div className="space-y-8">
          {/* Header */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Palette className="h-5 w-5 text-amber-400" />
                <span>Site Branding Management</span>
              </h2>
              <p className="text-xs text-zinc-400 max-w-2xl">
                Independently customize BEEEJOY&apos;s square icon and site name wordmark without editing source code or redeploying. Both assets are completely separate.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadBrandingSettings}
                disabled={loadingBranding}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingBranding ? "animate-spin" : ""}`} />
                <span>Reload Assets</span>
              </button>
            </div>
          </div>

          {/* Live Header Simulation Bar */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="h-4 w-4 text-amber-400" />
                  <span>Live Header Preview</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  How BEEEJOY&apos;s brand header appears to site visitors right now
                </p>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                {brandingConfig?.updated_at
                  ? `Last updated: ${new Date(brandingConfig.updated_at).toLocaleString()}`
                  : "Using default branding"}
              </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex items-center gap-3">
              {/* Square Icon preview */}
              {brandingConfig?.icon_url ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 p-1.5 shadow-lg shadow-black/40">
                  <img
                    src={brandingConfig.icon_url}
                    alt="Square Icon"
                    className="h-full w-full object-contain"
                  />
                </span>
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-lg font-black text-zinc-950 shadow-lg shadow-amber-500/20">
                  B
                </span>
              )}
              {/* Wordmark preview */}
              <div className="flex items-center gap-2">
                {brandingConfig?.wordmark_url ? (
                  <img
                    src={brandingConfig.wordmark_url}
                    alt="BEEEJOY"
                    className="h-6 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <span className="text-xl font-bold tracking-tight text-white">
                    BEEEJOY
                  </span>
                )}
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-400 uppercase">
                  Software Store
                </span>
              </div>
            </div>
          </div>

          {/* Two Independent Columns */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Card 1: Square Icon Logo */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
              <div className="border-b border-zinc-800/80 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                      A
                    </span>
                    <span>Square Icon Logo</span>
                  </h3>
                  {brandingConfig?.icon_url ? (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5">
                      Custom Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium px-2 py-0.5">
                      Default &apos;B&apos;
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Replaces the square icon badge on the left side of the header.
                </p>
              </div>

              {/* Current Icon State */}
              <div>
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Current Square Icon
                </p>
                {brandingConfig?.icon_url ? (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/80">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-inner">
                        <img
                          src={brandingConfig.icon_url}
                          alt="Current Icon"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Custom SVG Active</span>
                        </p>
                        <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[180px]">
                          {brandingConfig.icon_storage_path || "branding/icon.svg"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveIcon}
                      disabled={actionLoading === "remove_icon"}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {actionLoading === "remove_icon" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-xl font-black text-zinc-950 shadow-md shadow-amber-500/20">
                      B
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Default &apos;B&apos; Icon Active</p>
                      <p className="text-[11px] text-zinc-500">No custom SVG uploaded. Fallback icon is active.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Form */}
              <form onSubmit={handleUploadIcon} className="space-y-4 pt-2 border-t border-zinc-800/80">
                <label className="block text-xs font-bold text-zinc-200">
                  {brandingConfig?.icon_url ? "Replace Square Icon (SVG)" : "Upload Square Icon (SVG)"}
                </label>

                <div className="relative">
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setIconFile(file);
                      if (file) {
                        setIconPreview(URL.createObjectURL(file));
                      } else {
                        setIconPreview(null);
                      }
                    }}
                    className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-zinc-700 file:bg-zinc-800 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />
                </div>

                {/* Local selection preview */}
                {iconPreview && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 p-1">
                        <img src={iconPreview} alt="Selected preview" className="h-full w-full object-contain" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white truncate max-w-[200px]">{iconFile?.name}</p>
                        <p className="text-[10px] text-zinc-400">{((iconFile?.size || 0) / 1024).toFixed(1)} KB &bull; Ready to upload</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIconFile(null);
                        setIconPreview(null);
                      }}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!iconFile || actionLoading === "upload_icon"}
                  className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading === "upload_icon" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Validating & Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>{brandingConfig?.icon_url ? "Replace Square Icon" : "Upload Square Icon"}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Card 2: Site Name / Wordmark */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
              <div className="border-b border-zinc-800/80 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                      B
                    </span>
                    <span>Site Name / Wordmark</span>
                  </h3>
                  {brandingConfig?.wordmark_url ? (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5">
                      Custom Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium px-2 py-0.5">
                      Default Text
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Replaces the site name &apos;BEEEJOY&apos; text beside the square icon.
                </p>
              </div>

              {/* Current Wordmark State */}
              <div>
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Current Site Wordmark
                </p>
                {brandingConfig?.wordmark_url ? (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/80">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 px-3 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 shadow-inner">
                        <img
                          src={brandingConfig.wordmark_url}
                          alt="Current Wordmark"
                          className="h-6 w-auto max-w-[140px] object-contain"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Custom SVG Active</span>
                        </p>
                        <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[180px]">
                          {brandingConfig.wordmark_storage_path || "branding/wordmark.svg"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveWordmark}
                      disabled={actionLoading === "remove_wordmark"}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {actionLoading === "remove_wordmark" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40">
                    <span className="text-xl font-bold tracking-tight text-white px-2">
                      BEEEJOY
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Default &apos;BEEEJOY&apos; Text Active</p>
                      <p className="text-[11px] text-zinc-500">No custom SVG uploaded. Standard typography is active.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Form */}
              <form onSubmit={handleUploadWordmark} className="space-y-4 pt-2 border-t border-zinc-800/80">
                <label className="block text-xs font-bold text-zinc-200">
                  {brandingConfig?.wordmark_url ? "Replace Site Wordmark (SVG)" : "Upload Site Wordmark (SVG)"}
                </label>

                <div className="relative">
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setWordmarkFile(file);
                      if (file) {
                        setWordmarkPreview(URL.createObjectURL(file));
                      } else {
                        setWordmarkPreview(null);
                      }
                    }}
                    className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-zinc-700 file:bg-zinc-800 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />
                </div>

                {/* Local selection preview */}
                {wordmarkPreview && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 px-2 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800">
                        <img src={wordmarkPreview} alt="Selected preview" className="h-5 w-auto max-w-[140px] object-contain" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white truncate max-w-[200px]">{wordmarkFile?.name}</p>
                        <p className="text-[10px] text-zinc-400">{((wordmarkFile?.size || 0) / 1024).toFixed(1)} KB &bull; Ready to upload</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setWordmarkFile(null);
                        setWordmarkPreview(null);
                      }}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!wordmarkFile || actionLoading === "upload_wordmark"}
                  className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading === "upload_wordmark" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Validating & Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>{brandingConfig?.wordmark_url ? "Replace Site Wordmark" : "Upload Site Wordmark"}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* SVG Security & Guidelines Footer */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-2 text-xs text-zinc-400">
            <h4 className="font-bold text-zinc-200 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>SVG Security & Specifications</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-zinc-500 text-[11px]">
              <li>Only valid SVG files up to 2MB are accepted.</li>
              <li>Every upload is strictly sanitized on the server: script tags, inline event handlers (<code className="text-zinc-400">onload</code>, <code className="text-zinc-400">onclick</code>), <code className="text-zinc-400">&lt;foreignObject&gt;</code>, executable URI schemes (<code className="text-zinc-400">javascript:</code>), and external CSS/resource imports are automatically blocked.</li>
              <li>Square Icon: Recommended 1:1 aspect ratio with clean vector outlines.</li>
              <li>Site Wordmark: Recommended horizontal aspect ratio (around 3:1 to 5:1) with white or light-colored elements to contrast against dark backgrounds.</li>
            </ul>
          </div>
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
                      Price & Currency {productType === "premium" && <span className="text-rose-400">*</span>}
                    </label>
                    <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 overflow-hidden">
                      <select
                        disabled={productType === "free"}
                        value={productCurrency}
                        onChange={(e) => setProductCurrency(e.target.value as "BDT" | "USD")}
                        className="bg-zinc-900 text-zinc-200 text-xs font-bold px-2.5 py-2.5 border-r border-zinc-800 focus:outline-none disabled:opacity-40"
                      >
                        <option value="BDT">BDT (৳)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                      <input
                        type="number"
                        step={productCurrency === "USD" ? "0.01" : "1"}
                        min="0"
                        disabled={productType === "free"}
                        value={productType === "free" ? "0" : productPriceBdt}
                        onChange={(e) => setProductPriceBdt(e.target.value)}
                        placeholder="999"
                        className="w-full bg-transparent px-3 py-2.5 text-zinc-100 disabled:opacity-40 focus:outline-none font-mono text-sm"
                      />
                    </div>
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
                              {isFree ? "Free Download" : `${formatPrice(prod.price_cents || 0, prod.currency || "BDT")} ${prod.currency || "BDT"}`}
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
