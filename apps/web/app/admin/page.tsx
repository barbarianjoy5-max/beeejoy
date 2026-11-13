"use client";

import React, { useEffect, useState } from "react";
import { useAuth, getClientAccessToken } from "../../lib/auth-context";
import { insforge } from "../../lib/insforge";
import { Product, formatPrice, HomepageAnimationConfig, SiteBrandingConfig, HeroContentConfig, SiteThemeColors, SiteThemeFonts } from "../../lib/types";
import { DEFAULT_HERO_CONTENT, HERO_LIMITS, normalizeHeroContent } from "../../lib/hero-content";
import {
  BRANDING_SIZE_LIMITS,
  DEFAULT_BRANDING_SIZES,
  DEFAULT_THEME_COLORS,
  DEFAULT_THEME_FONTS,
  THEME_COLOR_KEYS,
  THEME_COLOR_LABELS,
  THEME_FONT_KEYS,
  THEME_FONT_LABELS,
  FONT_PRESETS,
  isValidHex,
  getGoogleFontFamilies,
  buildGoogleFontsUrl,
  avatarSizeCss,
  iconSizeCss,
  normalizeBrandingSizes,
  wordmarkMaxWidthCss,
  wordmarkSizeCss,
  wordmarkTextSizeCss,
  type BrandingSizeKey,
  type BrandingSizes,
  type ThemeColorKey,
  type ThemeFontKey,
} from "../../lib/branding";
import { getYouTubeVideoId, getYouTubeEmbedUrl } from "../../lib/youtube";
import TypewriterText from "../../components/TypewriterText";
import WebsiteAnalyticsPanel from "../../components/WebsiteAnalyticsPanel";
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
  BarChart3,
  RotateCcw,
  UserCircle2,
  CreditCard,
  LayoutDashboard,
  X,
} from "lucide-react";
import Link from "next/link";

/**
 * One smooth range control for a branding display size.
 *
 * Shared by the square icon, the wordmark and the global seller picture
 * sliders so all three behave identically: whole-pixel steps, the live value
 * beside the label, a filled track that follows the thumb, and the accepted
 * min/max printed underneath.
 */
function BrandingSizeSlider({
  label,
  sizeKey,
  value,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  sizeKey: BrandingSizeKey;
  value: number;
  onChange: (value: number) => void;
  hint: string;
  disabled?: boolean;
}) {
  const { min, max } = BRANDING_SIZE_LIMITS[sizeKey];
  const safeValue = Math.min(max, Math.max(min, Math.round(value)));
  const fillPercent = ((safeValue - min) / (max - min)) * 100;
  const defaultPx = DEFAULT_BRANDING_SIZES[sizeKey];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-bold text-zinc-200">{label}</label>
        <span className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] font-mono font-semibold text-amber-400 tabular-nums">
          {safeValue} px
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={safeValue}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="beejoy-range mt-3 w-full"
        style={{ ["--range-fill" as string]: `${fillPercent}%` } as React.CSSProperties}
      />

      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-zinc-600">
        <span>{min} px</span>
        <span>
          Default {defaultPx} px
          {safeValue !== defaultPx && (
            <span className="ml-1 text-amber-400/80">&bull; adjusted</span>
          )}
        </span>
        <span>{max} px</span>
      </div>

      <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">{hint}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user, profile, isAdmin, isLoading: authLoading } = useAuth();
  const [adminTab, setAdminTab] = useState<"overview" | "products" | "reviews" | "sellers" | "animation" | "hero" | "branding" | "analytics" | "membership">("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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
  const [iconLightFile, setIconLightFile] = useState<File | null>(null);
  const [iconLightPreview, setIconLightPreview] = useState<string | null>(null);
  const [wordmarkFile, setWordmarkFile] = useState<File | null>(null);
  const [wordmarkPreview, setWordmarkPreview] = useState<string | null>(null);
  const [wordmarkLightFile, setWordmarkLightFile] = useState<File | null>(null);
  const [wordmarkLightPreview, setWordmarkLightPreview] = useState<string | null>(null);
  const [brandingPreviewTheme, setBrandingPreviewTheme] = useState<"dark" | "light">("dark");
  // Unsaved slider values. Saved values live inside brandingConfig.
  const [brandingSizeDraft, setBrandingSizeDraft] = useState<BrandingSizes>(DEFAULT_BRANDING_SIZES);

  // Theme Colors & Fonts state (draft for live preview before saving)
  const [themeColorsDraft, setThemeColorsDraft] = useState<SiteThemeColors>(DEFAULT_THEME_COLORS);
  const [themeFontsDraft, setThemeFontsDraft] = useState<SiteThemeFonts>(DEFAULT_THEME_FONTS);
  const [savingTheme, setSavingTheme] = useState(false);

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
  const [membershipSeller, setMembershipSeller] = useState<any | null>(null);
  const [membershipForm, setMembershipForm] = useState<any>({});
  const [savingMembership, setSavingMembership] = useState(false);

  // Form state (existing admin product management)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productType, setProductType] = useState<"free" | "premium">("free");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
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
  // Membership payments state
  const [membershipPayments, setMembershipPayments] = useState<any[]>([]);
  const [loadingMembershipPayments, setLoadingMembershipPayments] = useState(false);
  const [membershipReviewLoading, setMembershipReviewLoading] = useState<string | null>(null);

  // Membership pricing & plan features state
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState<string | null>(null);
  const [globalRules, setGlobalRules] = useState<{ free_basic_on_registration: boolean }>({
    free_basic_on_registration: true,
  });
  const [savingGlobalRules, setSavingGlobalRules] = useState(false);
  const [pricingDraft, setPricingDraft] = useState<
    Record<
      string,
      {
        price: string;
        enabled: boolean;
        duration_value: string;
        duration_unit: string;
        features: {
          product_limit: number;
          product_priority: number;
          whatsapp_enabled: boolean;
          profile_picture_enabled: boolean;
          cover_photo_enabled: boolean;
          showcase_enabled: boolean;
        };
      }
    >
  >({});
  const [resetOverrides, setResetOverrides] = useState<string[]>([]);

  const loadMembershipPricing = async () => {
    setPricingLoading(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/membership-pricing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.plans)) {
        setPricingPlans(data.plans);
        if (data.global_rules) {
          setGlobalRules(data.global_rules);
        }
        const draft: Record<string, any> = {};
        for (const p of data.plans) {
          draft[p.plan] = {
            price: p.price != null ? String(p.price) : "",
            enabled: !!p.enabled,
            duration_value: p.duration_value != null ? String(p.duration_value) : "",
            duration_unit: p.duration_unit || (p.plan === "pro" ? "months" : "days"),
            features: p.features || {
              product_limit: p.plan === "pro" ? 100 : p.plan === "premium" ? 25 : 5,
              product_priority: p.plan === "pro" ? 10 : p.plan === "premium" ? 5 : 0,
              whatsapp_enabled: true,
              profile_picture_enabled: true,
              cover_photo_enabled: p.plan !== "basic",
              showcase_enabled: p.plan === "pro",
            },
          };
        }
        setPricingDraft(draft);
      }
    } catch (err) {
      console.warn("Error loading membership pricing:", err);
    } finally {
      setPricingLoading(false);
    }
  };

  const handleToggleGlobalFreeBasic = async (newVal: boolean) => {
    setSavingGlobalRules(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/membership-pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          global_rules: { free_basic_on_registration: newVal },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update platform-wide Free Basic access");
      setGlobalRules({ free_basic_on_registration: newVal });
      setFeedback({ type: "success", message: "Platform-wide Free Basic access updated successfully." });
      await loadSellers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to update platform-wide Free Basic access" });
    } finally {
      setSavingGlobalRules(false);
    }
  };

  const savePlanPricing = async (plan: string) => {
    const draft = pricingDraft[plan];
    if (!draft) return;
    const priceNum = Number(draft.price);
    const minPrice = plan === "basic" ? 0 : 1;
    if (!Number.isFinite(priceNum) || priceNum < minPrice) {
      setFeedback({
        type: "error",
        message: plan === "basic" ? "Enter a valid non-negative BDT price (0 for free)." : "Enter a valid positive BDT price.",
      });
      return;
    }

    let duration_value: number | null = null;
    let duration_unit: string | null = null;

    if (plan === "basic") {
      if (draft.duration_value !== "" && draft.duration_value !== "0" && Number(draft.duration_value) > 0) {
        duration_value = Number(draft.duration_value);
        duration_unit = draft.duration_unit || "days";
      }
    } else {
      const durNum = Number(draft.duration_value);
      if (!Number.isInteger(durNum) || durNum <= 0) {
        setFeedback({ type: "error", message: `Please enter a valid positive duration for ${plan}.` });
        return;
      }
      duration_value = durNum;
      duration_unit = draft.duration_unit || (plan === "pro" ? "months" : "days");
    }

    setPricingSaving(plan);
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/membership-pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan,
          price: priceNum,
          enabled: draft.enabled,
          duration_value,
          duration_unit,
          features: draft.features,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save plan settings");
      setFeedback({ type: "success", message: data.message || "Plan updated." });
      await loadMembershipPricing();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to save plan settings" });
    } finally {
      setPricingSaving(null);
    }
  };

  const loadMembershipPayments = async () => {
    setLoadingMembershipPayments(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/membership-payments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setMembershipPayments(data.payments || []);
    } catch (err) {
      console.warn("Error loading membership payments:", err);
    } finally {
      setLoadingMembershipPayments(false);
    }
  };

  const reviewMembershipPayment = async (paymentId: string, decision: "approved" | "rejected") => {
    const notes = window.prompt(
      decision === "approved"
        ? "Approve this membership payment? Optional admin notes:"
        : "Reject this membership payment? Optional admin notes:",
      ""
    );
    if (notes === null) return; // cancelled

    setMembershipReviewLoading(paymentId);
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/membership-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentId, decision, notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed");
      setFeedback({ type: "success", message: `Payment ${decision}.` });
      await loadMembershipPayments();
      await loadSellers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to review payment" });
    } finally {
      setMembershipReviewLoading(null);
    }
  };

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
        setBrandingSizeDraft(normalizeBrandingSizes(data.branding));
        setThemeColorsDraft({
          ...DEFAULT_THEME_COLORS,
          ...(data.branding.colors || {}),
        });
        setThemeFontsDraft({
          ...DEFAULT_THEME_FONTS,
          ...(data.branding.fonts || {}),
        });
      }
    } catch (err) {
      console.warn("Failed to load branding settings:", err);
    } finally {
      setLoadingBranding(false);
    }
  };

  type BrandingUploadTarget = "icon" | "wordmark" | "icon_light" | "wordmark_light";

  const submitBrandingUpload = async (
    e: React.FormEvent,
    target: BrandingUploadTarget,
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
    loadingKey: string
  ) => {
    e.preventDefault();
    if (!file) return;

    setActionLoading(loadingKey);
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const formData = new FormData();
      formData.append("target", target);
      formData.append("file", file);

      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload logo");

      setBrandingConfig(data.branding);
      setFile(null);
      setPreview(null);
      setFeedback({ type: "success", message: data.message || "Logo updated successfully!" });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to upload logo" });
    } finally {
      setActionLoading(null);
    }
  };

  const submitBrandingRemove = async (
    action: string,
    confirmMessage: string,
    loadingKey: string,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    if (!confirm(confirmMessage)) return;

    setActionLoading(loadingKey);
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove logo");

      setBrandingConfig(data.branding);
      setFile(null);
      setPreview(null);
      setFeedback({ type: "success", message: data.message || "Logo removed." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to remove logo" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUploadIcon = (e: React.FormEvent) =>
    submitBrandingUpload(e, "icon", iconFile, setIconFile, setIconPreview, "upload_icon");
  const handleUploadIconLight = (e: React.FormEvent) =>
    submitBrandingUpload(e, "icon_light", iconLightFile, setIconLightFile, setIconLightPreview, "upload_icon_light");
  const handleUploadWordmark = (e: React.FormEvent) =>
    submitBrandingUpload(e, "wordmark", wordmarkFile, setWordmarkFile, setWordmarkPreview, "upload_wordmark");
  const handleUploadWordmarkLight = (e: React.FormEvent) =>
    submitBrandingUpload(e, "wordmark_light", wordmarkLightFile, setWordmarkLightFile, setWordmarkLightPreview, "upload_wordmark_light");

  const handleRemoveIcon = () =>
    submitBrandingRemove(
      "remove_icon",
      "Are you sure you want to remove the custom square icon? The header will revert to the default 'B' icon.",
      "remove_icon",
      setIconFile,
      setIconPreview
    );
  const handleRemoveIconLight = () =>
    submitBrandingRemove(
      "remove_icon_light",
      "Are you sure you want to remove the Light Mode square icon? The header will fall back to the Dark Mode icon.",
      "remove_icon_light",
      setIconLightFile,
      setIconLightPreview
    );
  const handleRemoveWordmark = () =>
    submitBrandingRemove(
      "remove_wordmark",
      "Are you sure you want to remove the custom site wordmark? The header will revert to the default 'BEEEJOY' text.",
      "remove_wordmark",
      setWordmarkFile,
      setWordmarkPreview
    );
  const handleRemoveWordmarkLight = () =>
    submitBrandingRemove(
      "remove_wordmark_light",
      "Are you sure you want to remove the Light Mode site wordmark? The header will fall back to the Dark Mode wordmark.",
      "remove_wordmark_light",
      setWordmarkLightFile,
      setWordmarkLightPreview
    );

  // ----------------------------------------------------------------------------
  // Branding display sizes
  //
  // The sliders only edit a local draft, so the live preview reacts while
  // dragging and nothing is written until Save Changes. Every value is clamped
  // here for the UI and re-validated server-side in /api/admin/branding.
  // ----------------------------------------------------------------------------

  const updateBrandingSize = (key: BrandingSizeKey, value: number) => {
    setBrandingSizeDraft((prev) => ({
      ...prev,
      [key]: normalizeBrandingSizes({ ...prev, [key]: value })[key],
    }));
  };

  const resetHeaderSizes = () => {
    setBrandingSizeDraft((prev) => ({
      ...prev,
      icon_size_px: DEFAULT_BRANDING_SIZES.icon_size_px,
      wordmark_size_px: DEFAULT_BRANDING_SIZES.wordmark_size_px,
    }));
  };

  const resetAvatarSize = () => {
    setBrandingSizeDraft((prev) => ({
      ...prev,
      seller_avatar_size_px: DEFAULT_BRANDING_SIZES.seller_avatar_size_px,
    }));
  };

  const saveBrandingSizes = async (keys: BrandingSizeKey[]) => {
    setActionLoading("save_branding_sizes");
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const sizes = keys.reduce(
        (acc, key) => ({ ...acc, [key]: brandingSizeDraft[key] }),
        {} as Partial<BrandingSizes>
      );

      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "save_sizes", sizes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save display sizes");

      const saved = normalizeBrandingSizes(data.branding);
      setBrandingConfig(data.branding);
      // Only the keys just saved settle back to the server value; a draft still
      // being dragged in the other group stays untouched.
      setBrandingSizeDraft((prev) => {
        const next = { ...prev };
        keys.forEach((key) => {
          next[key] = saved[key];
        });
        return next;
      });
      setFeedback({ type: "success", message: data.message || "Display sizes saved successfully." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to save display sizes" });
    } finally {
      setActionLoading(null);
    }
  };

  // ----------------------------------------------------------------------------
  // Theme Colors & Typography handlers
  // ----------------------------------------------------------------------------
  const updateThemeColor = (key: ThemeColorKey, hex: string) => {
    setThemeColorsDraft((prev) => ({
      ...prev,
      [key]: hex,
    }));
  };

  const resetThemeColor = (key: ThemeColorKey) => {
    setThemeColorsDraft((prev) => ({
      ...prev,
      [key]: DEFAULT_THEME_COLORS[key],
    }));
  };

  const updateThemeFont = (key: ThemeFontKey, fontValue: string) => {
    setThemeFontsDraft((prev) => ({
      ...prev,
      [key]: fontValue,
    }));
  };

  const resetThemeFont = (key: ThemeFontKey) => {
    setThemeFontsDraft((prev) => ({
      ...prev,
      [key]: DEFAULT_THEME_FONTS[key],
    }));
  };

  const themeColorsSaved: SiteThemeColors = {
    ...DEFAULT_THEME_COLORS,
    ...(brandingConfig?.colors || {}),
  };

  const themeFontsSaved: SiteThemeFonts = {
    ...DEFAULT_THEME_FONTS,
    ...(brandingConfig?.fonts || {}),
  };

  const themeColorsDirty = THEME_COLOR_KEYS.some(
    (key) => (themeColorsDraft[key] || DEFAULT_THEME_COLORS[key]) !== (themeColorsSaved[key] || DEFAULT_THEME_COLORS[key])
  );

  const themeFontsDirty = THEME_FONT_KEYS.some(
    (key) => (themeFontsDraft[key] || DEFAULT_THEME_FONTS[key]) !== (themeFontsSaved[key] || DEFAULT_THEME_FONTS[key])
  );

  const themeDirty = themeColorsDirty || themeFontsDirty;

  const handleSaveTheme = async () => {
    setSavingTheme(true);
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "save_theme",
          colors: themeColorsDraft,
          fonts: themeFontsDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save theme settings");
      setBrandingConfig(data.branding);
      setFeedback({ type: "success", message: data.message || "Theme colors and typography saved successfully!" });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to save theme settings" });
    } finally {
      setSavingTheme(false);
    }
  };

  const handleResetTheme = async (target: "all" | "colors" | "fonts") => {
    if (!confirm(`Are you sure you want to reset ${target === "all" ? "all theme colors and fonts" : target} to defaults?`)) return;
    setSavingTheme(true);
    setFeedback(null);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "reset_theme",
          target,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset theme");
      setBrandingConfig(data.branding);
      if (target === "all" || target === "colors") setThemeColorsDraft(DEFAULT_THEME_COLORS);
      if (target === "all" || target === "fonts") setThemeFontsDraft(DEFAULT_THEME_FONTS);
      setFeedback({ type: "success", message: "Theme reset to default." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to reset theme" });
    } finally {
      setSavingTheme(false);
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
      loadMembershipPayments();
      loadMembershipPricing();
      loadCategories();
    }
  }, [isAdmin]);

  // Load software categories for the product form (public read policy)
  const loadCategories = async () => {
    try {
      const { data } = await insforge.database
        .from("categories")
        .select("id, name, slug")
        .order("display_order", { ascending: true });
      if (Array.isArray(data)) setCategories(data as any);
    } catch (err) {
      console.warn("Could not load categories:", err);
    }
  };

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
    setProductCategoryId("");
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
    setProductCategoryId(prod.category_id || "");
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
            category_id: productCategoryId || null,
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
              category_id: productCategoryId || null,
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

  const handleSaveMembership = async () => {
    if (!membershipSeller) return;
    setSavingMembership(true);
    try {
      const token = await getClientAccessToken();
      const res = await fetch("/api/admin/sellers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendorId: membershipSeller.id,
          ...membershipForm,
          reset_overrides: resetOverrides,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Membership update failed");
      setFeedback({ type: "success", message: data.message || "Membership updated." });
      setMembershipSeller(null);
      await loadSellers();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to update membership" });
    } finally {
      setSavingMembership(false);
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

  // Branding size editor derivations
  const savedBrandingSizes = normalizeBrandingSizes(brandingConfig ?? {});
  const headerSizesDirty =
    brandingSizeDraft.icon_size_px !== savedBrandingSizes.icon_size_px ||
    brandingSizeDraft.wordmark_size_px !== savedBrandingSizes.wordmark_size_px;
  const avatarSizeDirty =
    brandingSizeDraft.seller_avatar_size_px !== savedBrandingSizes.seller_avatar_size_px;
  // Representative seller picture for the avatar preview: the first active
  // store that actually has a profile picture, otherwise any store with one.
  const previewSeller =
    sellers.find((s) => s.status === "active" && s.user?.avatar_url) ||
    sellers.find((s) => s.user?.avatar_url) ||
    null;
  const previewSellerAvatarUrl: string | null = previewSeller?.user?.avatar_url || null;

  // Live header preview resolves the same theme-aware URLs the public header uses.
  const previewIconUrl =
    brandingPreviewTheme === "light"
      ? brandingConfig?.icon_light_url || brandingConfig?.icon_url
      : brandingConfig?.icon_url;
  const previewWordmarkUrl =
    brandingPreviewTheme === "light"
      ? brandingConfig?.wordmark_light_url || brandingConfig?.wordmark_url
      : brandingConfig?.wordmark_url;

  // Theme Fonts & Colors preview derivations
  const previewFontFamilies = getGoogleFontFamilies(themeFontsDraft);
  const previewGoogleFontsUrl = buildGoogleFontsUrl(previewFontFamilies);

  // ----------------------------------------------------------------------------
  // Grouped admin navigation
  // ----------------------------------------------------------------------------
  const pendingSellerApps = sellers.filter((s) => s.status === "pending").length;
  const pendingMembershipPayments = membershipPayments.filter(
    (p: any) => p.status === "paid_pending_review"
  ).length;

  const adminNavGroups: {
    label: string;
    items: { key: typeof adminTab; label: string; Icon: any; badge?: number }[];
  }[] = [
    {
      label: "Overview",
      items: [
        { key: "overview", label: "Dashboard", Icon: LayoutDashboard },
        { key: "analytics", label: "Website Analytics", Icon: BarChart3 },
      ],
    },
    {
      label: "Product Management",
      items: [
        { key: "products", label: "All Products", Icon: Package },
        { key: "reviews", label: "Pending Reviews", Icon: Clock, badge: pendingProducts.length },
      ],
    },
    {
      label: "Seller Management",
      items: [
        { key: "sellers", label: "Sellers & Applications", Icon: Users, badge: pendingSellerApps },
      ],
    },
    {
      label: "Payments & Membership",
      items: [
        { key: "membership", label: "Membership Payments", Icon: CreditCard, badge: pendingMembershipPayments },
      ],
    },
    {
      label: "Website Customization",
      items: [
        { key: "animation", label: "Homepage Animation", Icon: Sparkles },
        { key: "hero", label: "Hero Content", Icon: ImageIcon },
        { key: "branding", label: "Site Branding", Icon: Palette },
      ],
    },
  ];

  return (
    <div className="admin-scope mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Single Admin Control Panel</span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Marketplace Management
          </h1>
          <p className="mt-1.5 text-xs text-zinc-400">
            Logged in as <span className="font-mono text-zinc-200">{user.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/seller/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-xs font-semibold text-zinc-300 shadow-sm transition-all hover:border-amber-500/50 hover:text-white"
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
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 shadow-sm transition-all hover:border-zinc-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingData || loadingAnimation || loadingBranding || loadingHero ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Sidebar navigation controls */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => setMobileDrawerOpen(true)} className="lg:hidden inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 shadow-sm">
          <LayoutDashboard className="h-3.5 w-3.5 text-amber-400" />
          <span>Menu</span>
        </button>
        <button onClick={() => setSidebarCollapsed((v) => !v)} className="hidden lg:inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-400 shadow-sm transition-all hover:border-zinc-700 hover:text-white">
          <span>{sidebarCollapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setMobileDrawerOpen(false)}>
          <div className="h-full w-72 overflow-y-auto bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-bold text-white">Admin Menu</span>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-400 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              {adminNavGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map(({ key, label, Icon, badge }) => (
                      <button
                        key={key}
                        onClick={() => { setAdminTab(key); setMobileDrawerOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          adminTab === key
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "text-zinc-300 hover:bg-zinc-800"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{label}</span>
                        {badge ? (
                          <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-zinc-950">
                            {badge}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-8 lg:flex-row">
      <aside className={`hidden lg:block shrink-0 ${sidebarCollapsed ? "lg:w-16" : "lg:w-60"} lg:sticky lg:top-6 lg:self-start`}>
        <nav className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 shadow-sm">
        {adminNavGroups.map((group) => (
          <div key={group.label}>
            {!sidebarCollapsed && (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {group.label}
              </p>
            )}
            {sidebarCollapsed && <div className="mx-3 mb-1.5 border-t border-zinc-800" />}
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ key, label, Icon, badge }) => (
                <button
                  key={key}
                  onClick={() => setAdminTab(key)}
                  title={sidebarCollapsed ? label : undefined}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    adminTab === key
                      ? "bg-amber-500/10 text-amber-300 border border-amber-500/25 shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/70 border border-transparent"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${adminTab === key ? "text-amber-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                  {!sidebarCollapsed && <span className="truncate">{label}</span>}
                  {!sidebarCollapsed && badge ? (
                    <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-zinc-950">
                      {badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">

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

      {/* TAB: OVERVIEW */}
      {adminTab === "overview" && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white">Admin Overview</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Store health at a glance. Use the sidebar to manage each area.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Total Products", value: products.length, Icon: Package, tab: "products" as const, attention: false },
              { label: "Pending Reviews", value: pendingProducts.length, Icon: Clock, tab: "reviews" as const, attention: pendingProducts.length > 0 },
              { label: "Sellers", value: sellers.length, Icon: Users, tab: "sellers" as const, attention: false },
              { label: "Pending Seller Apps", value: pendingSellerApps, Icon: Store, tab: "sellers" as const, attention: pendingSellerApps > 0 },
              { label: "Membership Payments", value: membershipPayments.length, Icon: CreditCard, tab: "membership" as const, attention: false },
              { label: "Payments Awaiting Review", value: pendingMembershipPayments, Icon: CreditCard, tab: "membership" as const, attention: pendingMembershipPayments > 0 },
            ].map(({ label, value, Icon, tab, attention }) => (
              <button
                key={label}
                onClick={() => setAdminTab(tab)}
                className={`group rounded-2xl border p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  attention
                    ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                    attention
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 group-hover:text-amber-400"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-4 text-3xl font-extrabold tracking-tight text-white">{value}</p>
                {attention && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-400">Needs attention</p>
                )}
              </button>
            ))}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-white">Quick Actions</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {adminNavGroups.flatMap((g) => g.items).filter((i) => i.key !== "overview").map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setAdminTab(key)}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left text-xs font-semibold text-zinc-300 shadow-sm transition-all hover:border-amber-500/40 hover:bg-zinc-900 hover:text-white"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-amber-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: WEBSITE ANALYTICS */}
      {adminTab === "analytics" && <WebsiteAnalyticsPanel />}

      {/* TAB: MEMBERSHIP PAYMENTS */}
      {adminTab === "membership" && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Membership Payments</h2>
              <p className="text-xs text-zinc-500 mt-1">
                UddoktaPay seller membership payments awaiting review. Approval activates the plan via database RPC.
              </p>
            </div>
            <button
              onClick={() => { loadMembershipPayments(); loadMembershipPricing(); }}
              disabled={loadingMembershipPayments || pricingLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingMembershipPayments || pricingLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Membership Pricing & Plan Features */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Membership Plans & Features Management</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Define pricing, duration terms, and exact feature limits for Basic, Premium, and Pro plans. Changes apply dynamically across the Seller Dashboard and checkout.
                </p>
              </div>
            </div>

            {/* Platform-wide Free Basic Setting */}
            <div className="mb-5 rounded-2xl border border-zinc-800/90 bg-zinc-950/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Platform-wide Free Basic Access</span>
                  <span className="text-[10px] text-zinc-500 font-mono">(Governs all sellers set to 'Inherited')</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  When enabled, all sellers with 'Inherited' status enjoy complimentary baseline Basic access. When disabled, inherited sellers must maintain an active paid membership to list software.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0 bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-1.5">
                <input
                  type="checkbox"
                  checked={globalRules.free_basic_on_registration}
                  disabled={savingGlobalRules}
                  onChange={(e) => handleToggleGlobalFreeBasic(e.target.checked)}
                  className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
                />
                <span className={`text-xs font-semibold ${globalRules.free_basic_on_registration ? "text-emerald-400" : "text-rose-400"}`}>
                  {savingGlobalRules ? "Saving..." : globalRules.free_basic_on_registration ? "Enabled (Free for Inherited)" : "Disabled (Paid Required)"}
                </span>
              </label>
            </div>

            {pricingLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {pricingPlans.map((p: any) => {
                  const draft = pricingDraft[p.plan] || {
                    price: "",
                    enabled: false,
                    duration_value: "",
                    duration_unit: p.plan === "pro" ? "months" : "days",
                    features: {
                      product_limit: 5,
                      product_priority: 0,
                      whatsapp_enabled: true,
                      profile_picture_enabled: true,
                      cover_photo_enabled: false,
                      showcase_enabled: false,
                    },
                  };

                  const updateFeature = (key: string, val: any) => {
                    setPricingDraft((prev) => ({
                      ...prev,
                      [p.plan]: {
                        ...draft,
                        features: {
                          ...draft.features,
                          [key]: val,
                        },
                      },
                    }));
                  };

                  return (
                    <div
                      key={p.plan}
                      className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 transition-all"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white capitalize">{p.plan}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${
                              draft.enabled
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {draft.enabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.enabled}
                            onChange={(e) =>
                              setPricingDraft((prev) => ({
                                ...prev,
                                [p.plan]: { ...draft, enabled: e.target.checked },
                              }))
                            }
                            className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
                          />
                          <span className="text-[11px] font-medium">{draft.enabled ? "Enabled" : "Disabled"}</span>
                        </label>
                      </div>

                      {/* Price Row */}
                      <div className="mb-3">
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                          Plan Price (BDT)
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-500">৳</span>
                          <input
                            type="number"
                            min={p.plan === "basic" ? "0" : "1"}
                            step="1"
                            value={draft.price}
                            onChange={(e) =>
                              setPricingDraft((prev) => ({
                                ...prev,
                                [p.plan]: { ...draft, price: e.target.value },
                              }))
                            }
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white focus:border-amber-500 focus:outline-none"
                            placeholder={p.plan === "basic" ? "0 for free, or paid amount" : "e.g. 500"}
                          />
                        </div>
                      </div>

                      {/* Duration Row */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-zinc-400">Membership Duration</label>
                          {p.plan === "basic" && (
                            <span className="text-[10px] text-zinc-500">Empty / 0 = Permanent</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={draft.duration_value}
                            onChange={(e) =>
                              setPricingDraft((prev) => ({
                                ...prev,
                                [p.plan]: { ...draft, duration_value: e.target.value },
                              }))
                            }
                            placeholder={p.plan === "basic" ? "Permanent" : "e.g. 30"}
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                          <select
                            value={draft.duration_unit}
                            onChange={(e) =>
                              setPricingDraft((prev) => ({
                                ...prev,
                                [p.plan]: { ...draft, duration_unit: e.target.value },
                              }))
                            }
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                          >
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                            <option value="years">Years</option>
                          </select>
                        </div>
                      </div>

                      {/* Features Editor */}
                      <div className="space-y-3 pt-2 border-t border-zinc-800/60 flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90 mb-2">
                          Plan Features
                        </div>

                        {/* 1. Product Upload Limit */}
                        <div>
                          <label className="block text-[11px] text-zinc-300 mb-1">
                            Product Upload Limit
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.features?.product_limit ?? 5}
                            onChange={(e) => updateFeature("product_limit", Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>

                        {/* 2. Product Priority */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] text-zinc-300">Product Priority</label>
                            <span className="text-[10px] text-zinc-500">Higher = Homepage top</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.features?.product_priority ?? 0}
                            onChange={(e) => updateFeature("product_priority", Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>

                        {/* 3. WhatsApp Orders */}
                        <label className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2 cursor-pointer hover:bg-zinc-900">
                          <span className="text-[11px] text-zinc-300">WhatsApp Order Button</span>
                          <input
                            type="checkbox"
                            checked={!!draft.features?.whatsapp_enabled}
                            onChange={(e) => updateFeature("whatsapp_enabled", e.target.checked)}
                            className="h-3.5 w-3.5 accent-amber-500 rounded cursor-pointer"
                          />
                        </label>

                        {/* 4. Profile Picture */}
                        <label className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2 cursor-pointer hover:bg-zinc-900">
                          <span className="text-[11px] text-zinc-300">Store Avatar Upload</span>
                          <input
                            type="checkbox"
                            checked={!!draft.features?.profile_picture_enabled}
                            onChange={(e) => updateFeature("profile_picture_enabled", e.target.checked)}
                            className="h-3.5 w-3.5 accent-amber-500 rounded cursor-pointer"
                          />
                        </label>

                        {/* 5. Cover Photo */}
                        <label className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2 cursor-pointer hover:bg-zinc-900">
                          <span className="text-[11px] text-zinc-300">Store Banner / Cover Photo</span>
                          <input
                            type="checkbox"
                            checked={!!draft.features?.cover_photo_enabled}
                            onChange={(e) => updateFeature("cover_photo_enabled", e.target.checked)}
                            className="h-3.5 w-3.5 accent-amber-500 rounded cursor-pointer"
                          />
                        </label>

                        {/* 6. Homepage Showcase */}
                        <label className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2 cursor-pointer hover:bg-zinc-900">
                          <span className="text-[11px] text-zinc-300">Homepage Showcase Eligible</span>
                          <input
                            type="checkbox"
                            checked={!!draft.features?.showcase_enabled}
                            onChange={(e) => updateFeature("showcase_enabled", e.target.checked)}
                            className="h-3.5 w-3.5 accent-amber-500 rounded cursor-pointer"
                          />
                        </label>
                      </div>

                      {/* Save Button */}
                      <button
                        onClick={() => savePlanPricing(p.plan)}
                        disabled={pricingSaving === p.plan}
                        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2 text-xs font-bold text-zinc-950 shadow hover:bg-amber-400 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {pricingSaving === p.plan ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-3.5 w-3.5" />
                            <span>Save {p.plan} Plan</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {loadingMembershipPayments ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : membershipPayments.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <CreditCard className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No membership payments yet</h3>
              <p className="mt-1 text-xs text-zinc-400">Seller membership payments will appear here after gateway verification.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {membershipPayments.map((p: any) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white capitalize">{p.plan} Plan</span>
                        <span className="text-amber-400 font-black">{formatPrice(Math.round(Number(p.amount_bdt) * 100), p.currency || "BDT")}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                            p.status === "paid_pending_review"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : p.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : p.status === "rejected" || p.status === "failed"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-zinc-700/20 text-zinc-400 border-zinc-700/40"
                          }`}
                        >
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 space-y-0.5">
                        <p>Seller: <span className="text-zinc-200 font-semibold">{p.vendor_store_name || "Unknown"}</span></p>
                        <p>Reference: <span className="font-mono text-zinc-300">{p.reference}</span></p>
                        {p.gateway_txn_id && (
                          <p>Gateway Txn: <span className="font-mono text-zinc-300">{p.gateway_txn_id}</span></p>
                        )}
                        <p>Created: {new Date(p.created_at).toLocaleString()}</p>
                        {p.paid_at && <p>Paid: {new Date(p.paid_at).toLocaleString()}</p>}
                        {p.admin_notes && <p className="text-zinc-500">Notes: {p.admin_notes}</p>}
                      </div>
                    </div>

                    {p.status === "paid_pending_review" && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => reviewMembershipPayment(p.id, "approved")}
                          disabled={membershipReviewLoading === p.id}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {membershipReviewLoading === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => reviewMembershipPayment(p.id, "rejected")}
                          disabled={membershipReviewLoading === p.id}
                          className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                      <div className="flex flex-wrap items-center gap-2">
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
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                          Plan: {s.membership_plan || "basic"}
                        </span>
                        {/* Free Basic Entitlement Badge */}
                        {s.free_basic_status === "granted" ? (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Free Basic: Granted
                          </span>
                        ) : s.free_basic_status === "revoked" ? (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            Free Basic: Revoked
                          </span>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-800/80 text-zinc-400 border border-zinc-700">
                            Free Basic: Inherited ({globalRules.free_basic_on_registration ? "Free" : "Paid Req"})
                          </span>
                        )}
                        {/* Paid Plan Active Expiration Badge */}
                        {s.membership_expires_at && new Date(s.membership_expires_at).getTime() > Date.now() && (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            Paid Active (Expires {new Date(s.membership_expires_at).toLocaleDateString()})
                          </span>
                        )}
                        {/* Membership Required Alert Badge */}
                        {s.resolved_membership_state === "membership_required" && (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-rose-600/20 text-rose-300 border border-rose-500/40">
                            Membership Required
                          </span>
                        )}
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
                      <Link
                        href={`/seller/${s.slug}`}
                        target="_blank"
                        className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </Link>
                      <button
                        onClick={() => {
                          setMembershipSeller(s);
                          setResetOverrides([]);
                          setMembershipForm({
                            membership_plan: s.membership_plan || "basic",
                            free_basic_status: s.free_basic_status || "inherit",
                            product_limit: s.product_limit ?? 5,
                            whatsapp_enabled: s.whatsapp_enabled ?? true,
                            profile_picture_enabled: s.profile_picture_enabled ?? true,
                            cover_photo_enabled: s.cover_photo_enabled ?? true,
                            product_priority: s.product_priority ?? 0,
                            showcase_enabled: s.showcase_enabled ?? false,
                            downloadable_enabled: s.downloadable_enabled ?? true,
                          });
                        }}
                        className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Membership</span>
                      </button>

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

      {/* Membership Modal */}
      {membershipSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Seller Membership: {membershipSeller.store_name}</h3>
                <p className="text-[11px] text-zinc-400">
                  Manage individual plan assignment and custom permission overrides.
                </p>
              </div>
              <button
                onClick={() => setMembershipSeller(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Plan Selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Membership Plan</label>
                <select
                  value={membershipForm.membership_plan || "basic"}
                  onChange={(e) => {
                    const newPlan = e.target.value;
                    const planDef = pricingDraft[newPlan]?.features || {
                      product_limit: newPlan === "pro" ? 100 : newPlan === "premium" ? 25 : 5,
                      product_priority: newPlan === "pro" ? 10 : newPlan === "premium" ? 5 : 0,
                      whatsapp_enabled: true,
                      profile_picture_enabled: true,
                      cover_photo_enabled: newPlan !== "basic",
                      showcase_enabled: newPlan === "pro",
                    };
                    const updatedForm = { ...membershipForm, membership_plan: newPlan };
                    if (newPlan !== "custom") {
                      const overrides = (membershipSeller.payout_info?.custom_overrides || {}) as Record<string, boolean>;
                      for (const [k, v] of Object.entries(planDef)) {
                        if (!overrides[k] || resetOverrides.includes(k)) {
                          (updatedForm as any)[k] = v;
                        }
                      }
                    }
                    setMembershipForm(updatedForm);
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="basic">Basic Plan</option>
                  <option value="premium">Premium Plan</option>
                  <option value="pro">Pro Plan</option>
                  <option value="custom">Custom (All permissions independent)</option>
                </select>
                <p className="mt-1 text-[10px] text-zinc-500">
                  {membershipForm.membership_plan === "custom"
                    ? "Custom plan: permissions will never be modified by automated plan defaults."
                    : "Standard plan: permissions inherit plan features unless overridden below."}
                </p>
              </div>

              {/* Free Basic Access Entitlement */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Free Basic Access Entitlement
                </label>
                <select
                  value={membershipForm.free_basic_status || "inherit"}
                  onChange={(e) =>
                    setMembershipForm({ ...membershipForm, free_basic_status: e.target.value })
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="inherit">
                    Inherit Global Policy (
                    {globalRules.free_basic_on_registration
                      ? "Currently ON — All Inherited Sellers Eligible"
                      : "Currently OFF — All Inherited Sellers Not Eligible"}
                    )
                  </option>
                  <option value="granted">Explicitly Grant — Always Free Basic (overrides global OFF)</option>
                  <option value="revoked">Revoke — Paid Membership Required (overrides global ON)</option>
                </select>
                <p className="mt-1 text-[10px] text-zinc-500">
                  {membershipForm.free_basic_status === "revoked"
                    ? "Revoked: Seller cannot use Free Basic. If Basic price is ৳0, they still cannot activate Basic. Must purchase a paid membership."
                    : membershipForm.free_basic_status === "granted"
                    ? "Granted: Seller receives permanent Free Basic regardless of the platform-wide toggle."
                    : "Inherited: Follows the platform-wide Free Basic toggle in Membership Pricing settings."}
                </p>
                {membershipSeller.membership_expires_at &&
                  new Date(membershipSeller.membership_expires_at).getTime() > Date.now() && (
                    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                      <strong>Notice:</strong> This seller has an active paid plan until{" "}
                      <strong>
                        {new Date(membershipSeller.membership_expires_at).toLocaleString()}
                      </strong>
                      . Revoking Free Basic will take effect after this paid plan expires.
                    </div>
                  )}
              </div>

              {/* 1. Product Limit */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Product Limit</span>
                    {membershipSeller.payout_info?.custom_overrides?.product_limit && !resetOverrides.includes("product_limit") ? (
                      <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                        Custom Override
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500">Plan Default</span>
                    )}
                  </div>
                  {membershipSeller.payout_info?.custom_overrides?.product_limit && !resetOverrides.includes("product_limit") && (
                    <button
                      type="button"
                      onClick={() => {
                        const def = pricingDraft[membershipForm.membership_plan]?.features?.product_limit ?? 5;
                        setMembershipForm({ ...membershipForm, product_limit: def });
                        setResetOverrides((prev) => [...prev, "product_limit"]);
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                    >
                      Reset to Default ({pricingDraft[membershipForm.membership_plan]?.features?.product_limit ?? 5})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  value={membershipForm.product_limit ?? 5}
                  onChange={(e) => setMembershipForm({ ...membershipForm, product_limit: Number(e.target.value) })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* 2. Product Priority */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Product Priority</span>
                    {membershipSeller.payout_info?.custom_overrides?.product_priority && !resetOverrides.includes("product_priority") ? (
                      <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                        Custom Override
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500">Plan Default</span>
                    )}
                  </div>
                  {membershipSeller.payout_info?.custom_overrides?.product_priority && !resetOverrides.includes("product_priority") && (
                    <button
                      type="button"
                      onClick={() => {
                        const def = pricingDraft[membershipForm.membership_plan]?.features?.product_priority ?? 0;
                        setMembershipForm({ ...membershipForm, product_priority: def });
                        setResetOverrides((prev) => [...prev, "product_priority"]);
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                    >
                      Reset to Default ({pricingDraft[membershipForm.membership_plan]?.features?.product_priority ?? 0})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  value={membershipForm.product_priority ?? 0}
                  onChange={(e) => setMembershipForm({ ...membershipForm, product_priority: Number(e.target.value) })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                {[
                  { key: "whatsapp_enabled", label: "WhatsApp Order Button" },
                  { key: "profile_picture_enabled", label: "Store Avatar Upload" },
                  { key: "cover_photo_enabled", label: "Store Banner / Cover Photo" },
                  { key: "showcase_enabled", label: "Homepage Showcase Eligible" },
                ].map(({ key, label }) => {
                  const isOverridden = membershipSeller.payout_info?.custom_overrides?.[key] && !resetOverrides.includes(key);
                  return (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-2.5">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-zinc-200 cursor-pointer">{label}</label>
                        {isOverridden ? (
                          <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1 py-0.5 text-[8px] font-bold text-amber-400">
                            Override
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => {
                              const def = (pricingDraft[membershipForm.membership_plan]?.features as any)?.[key] ?? false;
                              setMembershipForm({ ...membershipForm, [key]: def });
                              setResetOverrides((prev) => [...prev, key]);
                            }}
                            className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                          >
                            Reset
                          </button>
                        )}
                        <input
                          type="checkbox"
                          checked={!!membershipForm[key]}
                          onChange={(e) => setMembershipForm({ ...membershipForm, [key]: e.target.checked })}
                          className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setMembershipSeller(null)}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMembership}
                disabled={savingMembership}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 transition-all cursor-pointer"
              >
                {savingMembership ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Membership</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


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
                  How BEEEJOY&apos;s brand header appears to site visitors right now (unsaved slider values included)
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Preview theme switcher */}
                <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBrandingPreviewTheme(t)}
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${
                        brandingPreviewTheme === t
                          ? "bg-amber-500 text-zinc-950"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {brandingConfig?.updated_at
                    ? `Last updated: ${new Date(brandingConfig.updated_at).toLocaleString()}`
                    : "Using default branding"}
                </span>
              </div>
            </div>

            <div
              className={`rounded-xl border p-4 flex items-center gap-3 overflow-hidden transition-colors ${
                brandingPreviewTheme === "light"
                  ? "border-zinc-200 bg-white"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              {/* Square Icon preview */}
              {previewIconUrl ? (
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border p-1.5 shadow-lg transition-all overflow-hidden ${
                    brandingPreviewTheme === "light"
                      ? "bg-zinc-100 border-zinc-200 shadow-black/10"
                      : "bg-zinc-900 border-zinc-800 shadow-black/40"
                  }`}
                  style={{
                    width: iconSizeCss(brandingSizeDraft.icon_size_px),
                    height: iconSizeCss(brandingSizeDraft.icon_size_px),
                  }}
                >
                  <img
                    src={previewIconUrl}
                    alt="Square Icon"
                    className="h-full w-full object-contain"
                  />
                </span>
              ) : (
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 font-black text-zinc-950 shadow-lg shadow-amber-500/20 transition-all"
                  style={{
                    width: iconSizeCss(brandingSizeDraft.icon_size_px),
                    height: iconSizeCss(brandingSizeDraft.icon_size_px),
                    fontSize: `calc(${iconSizeCss(brandingSizeDraft.icon_size_px)} * 0.45)`,
                  }}
                >
                  B
                </span>
              )}
              {/* Wordmark preview */}
              <div className="flex items-center gap-2 min-w-0">
                {previewWordmarkUrl ? (
                  <img
                    src={previewWordmarkUrl}
                    alt="BEEEJOY"
                    className="h-6 w-auto max-w-[160px] shrink-0 object-contain"
                    style={{
                      height: wordmarkSizeCss(brandingSizeDraft.wordmark_size_px),
                      maxWidth: wordmarkMaxWidthCss(brandingSizeDraft.wordmark_size_px),
                    }}
                  />
                ) : (
                  <span
                    className={`text-xl font-bold tracking-tight shrink-0 ${
                      brandingPreviewTheme === "light" ? "text-zinc-900" : "text-white"
                    }`}
                    style={{ fontSize: wordmarkTextSizeCss(brandingSizeDraft.wordmark_size_px) }}
                  >
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
                  Current Square Icon (Dark Mode)
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

              {/* Display Size Control */}
              <div className="pt-5 border-t border-zinc-800/80">
                <BrandingSizeSlider
                  label="Square Icon Logo Size"
                  sizeKey="icon_size_px"
                  value={brandingSizeDraft.icon_size_px}
                  onChange={(value) => updateBrandingSize("icon_size_px", value)}
                  hint="Scales the icon badge in the live header on every page. Aspect ratio stays intact and the uploaded SVG file is never re-encoded."
                />
              </div>

              {/* Upload Form */}
              <form onSubmit={handleUploadIcon} className="space-y-4 pt-2 border-t border-zinc-800/80">
                <label className="block text-xs font-bold text-zinc-200">
                  {brandingConfig?.icon_url ? "Replace Square Icon — Dark Mode (SVG)" : "Upload Square Icon — Dark Mode (SVG)"}
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

              {/* Light Mode variant */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200">Light Mode Logo (SVG)</label>
                  {brandingConfig?.icon_light_url ? (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5">
                      Custom Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium px-2 py-0.5">
                      Using Dark Logo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 -mt-2">
                  Optional. Shown only while the site light theme is active; falls back to the Dark Mode icon.
                </p>

                {brandingConfig?.icon_light_url && (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-950/80">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 p-1">
                        <img
                          src={brandingConfig.icon_light_url}
                          alt="Light icon"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[180px]">
                        {brandingConfig.icon_light_storage_path}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveIconLight}
                      disabled={actionLoading === "remove_icon_light"}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {actionLoading === "remove_icon_light" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span>Remove</span>
                    </button>
                  </div>
                )}

                <form onSubmit={handleUploadIconLight} className="space-y-3">
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setIconLightFile(file);
                      if (file) {
                        setIconLightPreview(URL.createObjectURL(file));
                      } else {
                        setIconLightPreview(null);
                      }
                    }}
                    className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-zinc-700 file:bg-zinc-800 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />

                  {iconLightPreview && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 p-1">
                          <img src={iconLightPreview} alt="Selected preview" className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white truncate max-w-[200px]">{iconLightFile?.name}</p>
                          <p className="text-[10px] text-zinc-400">{((iconLightFile?.size || 0) / 1024).toFixed(1)} KB &bull; Ready to upload</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIconLightFile(null);
                          setIconLightPreview(null);
                        }}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!iconLightFile || actionLoading === "upload_icon_light"}
                    className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading === "upload_icon_light" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Validating & Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>{brandingConfig?.icon_light_url ? "Replace Light Mode Icon" : "Upload Light Mode Icon"}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
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
                  Current Site Wordmark (Dark Mode)
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

              {/* Display Size Control */}
              <div className="pt-5 border-t border-zinc-800/80">
                <BrandingSizeSlider
                  label="Site Name / Wordmark Size"
                  sizeKey="wordmark_size_px"
                  value={brandingSizeDraft.wordmark_size_px}
                  onChange={(value) => updateBrandingSize("wordmark_size_px", value)}
                  hint="Sets the wordmark height. When no SVG is uploaded it also sets the size of the built-in site name text. Width follows the artwork, so nothing is stretched, and it stays aligned with the icon badge."
                />
              </div>

              {/* Upload Form */}
              <form onSubmit={handleUploadWordmark} className="space-y-4 pt-2 border-t border-zinc-800/80">
                <label className="block text-xs font-bold text-zinc-200">
                  {brandingConfig?.wordmark_url ? "Replace Site Wordmark — Dark Mode (SVG)" : "Upload Site Wordmark — Dark Mode (SVG)"}
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

              {/* Light Mode variant */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200">Light Mode Logo (SVG)</label>
                  {brandingConfig?.wordmark_light_url ? (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5">
                      Custom Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium px-2 py-0.5">
                      Using Dark Logo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 -mt-2">
                  Optional. Shown only while the site light theme is active; falls back to the Dark Mode wordmark.
                </p>

                {brandingConfig?.wordmark_light_url && (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-950/80">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 px-2 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900">
                        <img
                          src={brandingConfig.wordmark_light_url}
                          alt="Light wordmark"
                          className="h-5 w-auto max-w-[140px] object-contain"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[180px]">
                        {brandingConfig.wordmark_light_storage_path}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveWordmarkLight}
                      disabled={actionLoading === "remove_wordmark_light"}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {actionLoading === "remove_wordmark_light" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span>Remove</span>
                    </button>
                  </div>
                )}

                <form onSubmit={handleUploadWordmarkLight} className="space-y-3">
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setWordmarkLightFile(file);
                      if (file) {
                        setWordmarkLightPreview(URL.createObjectURL(file));
                      } else {
                        setWordmarkLightPreview(null);
                      }
                    }}
                    className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-zinc-700 file:bg-zinc-800 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />

                  {wordmarkLightPreview && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 px-2 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800">
                          <img src={wordmarkLightPreview} alt="Selected preview" className="h-5 w-auto max-w-[140px] object-contain" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white truncate max-w-[200px]">{wordmarkLightFile?.name}</p>
                          <p className="text-[10px] text-zinc-400">{((wordmarkLightFile?.size || 0) / 1024).toFixed(1)} KB &bull; Ready to upload</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setWordmarkLightFile(null);
                          setWordmarkLightPreview(null);
                        }}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!wordmarkLightFile || actionLoading === "upload_wordmark_light"}
                    className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading === "upload_wordmark_light" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Validating & Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>{brandingConfig?.wordmark_light_url ? "Replace Light Mode Wordmark" : "Upload Light Mode Wordmark"}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Display Size Actions (Square Icon + Wordmark) */}
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] space-y-0.5">
              {headerSizesDirty ? (
                <span className="font-semibold text-amber-400">Unsaved header size changes</span>
              ) : (
                <span className="font-semibold text-emerald-400">All header size changes saved</span>
              )}
              <p className="text-zinc-500">
                Saved sizes drive the real header on every public page and survive a refresh. Uploading or removing a logo never resets them.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={resetHeaderSizes}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset to Default</span>
              </button>
              <button
                type="button"
                onClick={() => saveBrandingSizes(["icon_size_px", "wordmark_size_px"])}
                disabled={!headerSizesDirty || actionLoading === "save_branding_sizes"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-40 transition-all"
              >
                {actionLoading === "save_branding_sizes" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          {/* SECTION: SELLER PROFILE PICTURE MANAGEMENT */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
            <div className="border-b border-zinc-800/80 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                    C
                  </span>
                  <span>Seller Profile Picture Management</span>
                </h3>
                <p className="text-xs text-zinc-400 max-w-2xl">
                  One global size control for the picture shown on every seller profile page. This only changes how the stored avatar is displayed: uploads, files and the circular crop stay exactly as they are.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 self-start rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-400 text-[10px] font-semibold px-2.5 py-1">
                <Users className="h-3 w-3" />
                <span>{sellers.length} {sellers.length === 1 ? "store" : "stores"} covered</span>
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <BrandingSizeSlider
                label="Seller Profile Picture Size"
                sizeKey="seller_avatar_size_px"
                value={brandingSizeDraft.seller_avatar_size_px}
                onChange={(value) => updateBrandingSize("seller_avatar_size_px", value)}
                hint="Applies to all sellers at once, on their public profile pages. The circle keeps its aspect ratio and the original upload is never resized or compressed."
                disabled={loadingBranding}
              />

              {/* Preview on a representative seller profile */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-amber-400" />
                  <span>Live Seller Preview</span>
                </p>

                <div className="mt-3 rounded-lg border border-zinc-800 bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-950 px-4 pt-6 pb-5 flex flex-col items-center gap-3 overflow-hidden">
                  <div
                    className="shrink-0 rounded-full border-4 border-zinc-950 bg-zinc-800 overflow-hidden shadow-2xl shadow-black/50"
                    style={{
                      width: avatarSizeCss(brandingSizeDraft.seller_avatar_size_px),
                      height: avatarSizeCss(brandingSizeDraft.seller_avatar_size_px),
                    }}
                  >
                    {previewSellerAvatarUrl ? (
                      <img
                        src={previewSellerAvatarUrl}
                        alt={previewSeller?.store_name || "Seller"}
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 font-black text-zinc-950"
                        style={{ fontSize: `calc(${avatarSizeCss(brandingSizeDraft.seller_avatar_size_px)} * 0.27)` }}
                      >
                        {(previewSeller?.store_name || "B").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="text-center min-w-0">
                    <p className="text-xs font-bold text-white truncate flex items-center justify-center gap-1.5">
                      <UserCircle2 className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="truncate">{previewSeller?.store_name || "No seller yet"}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] font-mono text-zinc-500">
                      {previewSeller ? `@${previewSeller.slug}` : "Add a seller to see a real picture"}
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-zinc-500">
                  {previewSellerAvatarUrl
                    ? "Representative seller shown at the size every seller profile will use."
                    : "No seller has uploaded a picture yet, so the initials placeholder is shown instead."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-800/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] space-y-0.5">
                {avatarSizeDirty ? (
                  <span className="font-semibold text-amber-400">Unsaved seller picture size</span>
                ) : (
                  <span className="font-semibold text-emerald-400">Seller picture size is saved</span>
                )}
                <p className="text-zinc-500">
                  Saved as part of the same site branding setting &mdash; no extra table, and no seller data is modified.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={resetAvatarSize}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset to Default</span>
                </button>
                <button
                  type="button"
                  onClick={() => saveBrandingSizes(["seller_avatar_size_px"])}
                  disabled={!avatarSizeDirty || actionLoading === "save_branding_sizes"}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-40 transition-all"
                >
                  {actionLoading === "save_branding_sizes" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION: THEME COLORS & TYPOGRAPHY CUSTOMIZATION */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Palette className="h-4 w-4 text-amber-400" />
                  <span>Color & Typography Customization</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Customize the public marketplace color scheme and font stack. Real-time preview updates instantly below.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResetTheme("all")}
                  disabled={savingTheme}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white transition-all disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset All Defaults</span>
                </button>
              </div>
            </div>

            {/* Dynamic font stylesheet link for instant preview */}
            {previewGoogleFontsUrl && (
              <link rel="stylesheet" href={previewGoogleFontsUrl} key={previewGoogleFontsUrl} />
            )}

            {/* Live Interactive Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-amber-400" />
                  <span>Live Storefront Preview</span>
                </h4>
                <span className="text-[10px] text-zinc-500 font-mono">
                  Contrast & Component Testing
                </span>
              </div>

              <div
                className="rounded-2xl border p-6 transition-all duration-200 overflow-hidden shadow-xl"
                style={{
                  backgroundColor: themeColorsDraft.page_bg || "#09090b",
                  borderColor: themeColorsDraft.border || "#27272a",
                }}
              >
                <div
                  className="rounded-xl border p-6 space-y-4 max-w-xl mx-auto shadow-md"
                  style={{
                    backgroundColor: themeColorsDraft.surface_bg || "#18181b",
                    borderColor: themeColorsDraft.border || "#27272a",
                  }}
                >
                  {/* Badge */}
                  <div>
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{
                        backgroundColor: `${themeColorsDraft.primary || "#fbbf24"}25`,
                        color: themeColorsDraft.primary || "#fbbf24",
                        border: `1px solid ${themeColorsDraft.primary || "#fbbf24"}50`,
                      }}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Featured Suite</span>
                    </div>

                    {/* Heading */}
                    <h3
                      className="text-xl sm:text-2xl font-black tracking-tight"
                      style={{
                        fontFamily: themeFontsDraft.heading || "system-ui",
                        color: themeColorsDraft.text_primary || "#f4f4f5",
                      }}
                    >
                      BEJOY SYSTEM ACTIVE &bull; Illustrator CEP
                    </h3>
                  </div>

                  {/* Body Text */}
                  <p
                    className="text-xs sm:text-sm leading-relaxed"
                    style={{
                      fontFamily: themeFontsDraft.body || "system-ui",
                      color: themeColorsDraft.text_muted || "#71717a",
                    }}
                  >
                    Experience automated pattern generation, instant licensing validation, and precision vector tools crafted specifically for professional textile and graphic designers.
                  </p>

                  {/* Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                      style={{
                        fontFamily: themeFontsDraft.button || "system-ui",
                        backgroundColor: themeColorsDraft.button_bg || "#f59e0b",
                        color: themeColorsDraft.button_text || "#09090b",
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Buy Now &bull; ৳999 BDT</span>
                    </button>

                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                      style={{
                        fontFamily: themeFontsDraft.button || "system-ui",
                        borderColor: themeColorsDraft.border || "#27272a",
                        color: themeColorsDraft.text_primary || "#f4f4f5",
                        backgroundColor: "transparent",
                      }}
                    >
                      <span>Explore Demo</span>
                    </button>

                    <span
                      className="text-xs font-semibold underline ml-auto cursor-pointer"
                      style={{ color: themeColorsDraft.accent || "#d97706" }}
                    >
                      Docs & Support &rarr;
                    </span>
                  </div>

                  {/* Swatches bar */}
                  <div
                    className="pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-[10px]"
                    style={{
                      borderColor: themeColorsDraft.border || "#27272a",
                      color: themeColorsDraft.text_muted || "#71717a",
                    }}
                  >
                    <span>Contrast Preview (10 Palette Channels):</span>
                    <div className="flex items-center gap-1.5">
                      {THEME_COLOR_KEYS.map((k) => (
                        <span
                          key={k}
                          title={`${THEME_COLOR_LABELS[k]}: ${themeColorsDraft[k] || DEFAULT_THEME_COLORS[k]}`}
                          className="w-4 h-4 rounded-full border border-black/30 shadow-xs inline-block"
                          style={{ backgroundColor: (themeColorsDraft[k] || DEFAULT_THEME_COLORS[k] || "#000000")! }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Typography Section (3 Fonts) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Type className="h-4 w-4 text-amber-400" />
                    <span>Typography Stack</span>
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Select curated web fonts for headings, general content, and interactive buttons.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {THEME_FONT_KEYS.map((fontKey) => {
                  const currentFont = themeFontsDraft[fontKey] || DEFAULT_THEME_FONTS[fontKey] || "system-ui, -apple-system, sans-serif";
                  const isCustom = currentFont !== DEFAULT_THEME_FONTS[fontKey];
                  return (
                    <div key={fontKey} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Type className="h-3.5 w-3.5 text-amber-400" />
                          <span>{THEME_FONT_LABELS[fontKey]}</span>
                        </label>
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => resetThemeFont(fontKey)}
                            className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <select
                        value={currentFont}
                        onChange={(e) => updateThemeFont(fontKey, e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      >
                        {FONT_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>

                      {/* Live Sample Text */}
                      <div
                        className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2.5 text-xs text-zinc-200 text-center truncate"
                        style={{ fontFamily: currentFont || "inherit" }}
                      >
                        {fontKey === "heading" ? "Heading Text Sample (Bold)" : fontKey === "button" ? "BUTTON: ৳999 BDT" : "Body text: Fast & clean typography"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Color Palette Customization (10 Settings) */}
            <div className="space-y-3 pt-2">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Palette className="h-4 w-4 text-amber-400" />
                  <span>Color Palette</span>
                </h4>
                <p className="text-xs text-zinc-400">
                  Each color provides a visual swatch color picker and an editable 6-character HEX input.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  {
                    title: "Brand & Accent Colors",
                    description: "Primary brand identity, secondary accents, and links.",
                    keys: ["primary", "secondary", "accent"] as ThemeColorKey[],
                  },
                  {
                    title: "Background & Surface Colors",
                    description: "Main page canvas, container cards, and structural borders.",
                    keys: ["page_bg", "surface_bg", "border"] as ThemeColorKey[],
                  },
                  {
                    title: "Typography Colors",
                    description: "Primary headings/titles and secondary muted metadata.",
                    keys: ["text_primary", "text_muted"] as ThemeColorKey[],
                  },
                  {
                    title: "Button Colors",
                    description: "Primary action buttons (Checkout, Buy Now, Upgrade).",
                    keys: ["button_bg", "button_text"] as ThemeColorKey[],
                  },
                ].map((group) => (
                  <div key={group.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-white">{group.title}</h5>
                      <p className="text-[11px] text-zinc-500">{group.description}</p>
                    </div>

                    <div className="space-y-2.5">
                      {group.keys.map((key) => {
                        const val = themeColorsDraft[key] || DEFAULT_THEME_COLORS[key] || "#000000";
                        const isCustom = themeColorsDraft[key] && themeColorsDraft[key] !== DEFAULT_THEME_COLORS[key];
                        const isHexValid = isValidHex(val);
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-zinc-200">
                                  {THEME_COLOR_LABELS[key]}
                                </span>
                                {isCustom && (
                                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.2">
                                    Custom
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono block">
                                Default: {DEFAULT_THEME_COLORS[key]}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Color Picker Swatch */}
                              <input
                                type="color"
                                value={isHexValid ? val : DEFAULT_THEME_COLORS[key] || "#000000"}
                                onChange={(e) => updateThemeColor(key, e.target.value)}
                                className="h-8 w-8 rounded-lg border border-zinc-700 bg-transparent cursor-pointer p-0.5"
                                title={`Pick ${THEME_COLOR_LABELS[key]}`}
                              />

                              {/* Editable HEX input */}
                              <input
                                type="text"
                                maxLength={7}
                                value={themeColorsDraft[key] ?? DEFAULT_THEME_COLORS[key] ?? ""}
                                onChange={(e) => updateThemeColor(key, e.target.value)}
                                placeholder="#000000"
                                className={`w-20 rounded-lg border px-2 py-1.5 text-xs font-mono text-center focus:outline-none ${
                                  isHexValid
                                    ? "border-zinc-700 bg-zinc-900 text-white focus:border-amber-500"
                                    : "border-rose-500 bg-rose-950/30 text-rose-300"
                                }`}
                              />

                              {/* Reset individual button */}
                              {isCustom && (
                                <button
                                  type="button"
                                  onClick={() => resetThemeColor(key)}
                                  className="text-zinc-400 hover:text-white p-1"
                                  title="Reset to default color"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save & Reset Bar */}
            <div className="flex flex-col gap-3 border-t border-zinc-800/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] space-y-0.5">
                {themeDirty ? (
                  <span className="font-semibold text-amber-400">You have unsaved theme changes</span>
                ) : (
                  <span className="font-semibold text-emerald-400">All theme settings are saved</span>
                )}
                <p className="text-zinc-500">
                  Settings are persisted in site_settings and applied globally across the public website with zero flash.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleResetTheme("all")}
                  disabled={savingTheme}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white transition-all disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset All to Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveTheme}
                  disabled={!themeDirty || savingTheme}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-40 transition-all cursor-pointer"
                >
                  {savingTheme ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Theme...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Save Theme Changes</span>
                    </>
                  )}
                </button>
              </div>
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

                {/* Software Category */}
                <div>
                  <label className="block font-bold uppercase text-zinc-400 mb-1.5">
                    Software Category <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={productCategoryId}
                    onChange={(e) => setProductCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-100 focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
      </div>
    </div>
  );
}

