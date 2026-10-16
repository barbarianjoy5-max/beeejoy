"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { insforge } from "../../lib/insforge";
import {
  ShieldAlert,
  CreditCard,
  Package,
  Key,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Plus,
  AlertCircle,
  FileCode,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { user, profile, isAdmin, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"products" | "releases" | "payments" | "licenses">("products");
  const [loadingData, setLoadingData] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Data states
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);

  // Product upload state
  const [productTitle, setProductTitle] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [productTagline, setProductTagline] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productType, setProductType] = useState("cep_extension");
  const [productPriceBdt, setProductPriceBdt] = useState("2499");
  const [productStatus, setProductStatus] = useState("published");
  const [productFeatures, setProductFeatures] = useState("Full Illustrator CEP Integration, 2 machine activations included, 7-day offline grace period");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [softwareFile, setSoftwareFile] = useState<File | null>(null);
  const [initialVersion, setInitialVersion] = useState("v1.0.0");
  const [minHostVersion, setMinHostVersion] = useState("Adobe Illustrator 2024 (28.0+)");

  // Standalone release upload state
  const [releaseProductId, setReleaseProductId] = useState("");
  const [releaseVersion, setReleaseVersion] = useState("v1.1.0");
  const [releaseChangelog, setReleaseChangelog] = useState("");
  const [releaseFile, setReleaseFile] = useState<File | null>(null);
  const [releaseHostVer, setReleaseHostVer] = useState("Illustrator 2024+");

  const loadData = async () => {
    setLoadingData(true);
    setFeedback(null);
    try {
      // 1. Load products
      const { data: prodsData } = await insforge.database
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (prodsData) {
        setProducts(prodsData);
        if (prodsData.length > 0 && !releaseProductId) {
          setReleaseProductId(prodsData[0].id);
        }
      }

      // 2. Load releases
      const { data: relsData } = await insforge.database
        .from("software_releases")
        .select(`
          id,
          product_id,
          version_str,
          storage_path,
          changelog,
          is_active,
          created_at,
          products (
            title,
            slug
          )
        `)
        .order("created_at", { ascending: false });

      if (relsData) setReleases(relsData);

      // 3. Load pending manual payment submissions
      const { data: subsData } = await insforge.database
        .from("manual_payment_submissions")
        .select(`
          id,
          order_id,
          payment_channel,
          sender_identifier,
          transaction_ref,
          status,
          created_at,
          orders (
            id,
            order_number,
            customer_id,
            total_amount_cents,
            currency,
            status
          )
        `)
        .order("created_at", { ascending: false });

      if (subsData) setPendingPayments(subsData);

      // 4. Load licenses
      const { data: licsData } = await insforge.database
        .from("licenses")
        .select(`
          id,
          order_id,
          customer_id,
          key_prefix,
          status,
          max_activations,
          current_activations,
          grace_period_days,
          created_at,
          products (
            title,
            slug
          )
        `)
        .order("created_at", { ascending: false });

      if (licsData) setLicenses(licsData);
    } catch (err: any) {
      console.warn("Failed to load admin data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  // Handle auto-slug from title
  const handleTitleChange = (val: string) => {
    setProductTitle(val);
    if (!productSlug || productSlug === productTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) {
      setProductSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    }
  };

  // Upload Product with Image & Software Package
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setActionLoading("create_product");
    setFeedback(null);

    try {
      // 1. Ensure admin has a vendor profile record
      let { data: vendor } = await insforge.database
        .from("vendors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!vendor) {
        const { data: newVendor, error: vErr } = await insforge.database
          .from("vendors")
          .insert([
            {
              user_id: user.id,
              store_name: "BEEEJOY Official Store",
              slug: "beeejoy-official",
              status: "active",
              commission_rate: 0,
            },
          ])
          .select()
          .single();

        if (vErr || !newVendor) throw new Error(vErr?.message || "Could not register official store vendor.");
        vendor = newVendor;
      }

      // 2. Upload thumbnail image if provided
      let thumbnailUrl: string | null = null;
      if (imageFile) {
        const cleanSlug = productSlug.trim().toLowerCase();
        const imgExt = imageFile.name.split(".").pop() || "png";
        const imgPath = `thumbnails/${cleanSlug}-${Date.now()}.${imgExt}`;

        const uploadRes = await insforge.storage.from("public-assets").upload(imgPath, imageFile);
        if (uploadRes.error) {
          console.warn("Image upload warning:", uploadRes.error);
        } else {
          const { data: urlData } = insforge.storage.from("public-assets").getPublicUrl(imgPath);
          thumbnailUrl = urlData?.publicUrl || null;
        }
      }

      // 3. Insert product record
      if (!vendor) throw new Error("Vendor profile missing");
      const priceCents = Math.round(parseFloat(productPriceBdt) * 100);
      const featureList = productFeatures.split(",").map((f) => f.trim()).filter(Boolean);

      const { data: createdProd, error: pErr } = await insforge.database
        .from("products")
        .insert([
          {
            vendor_id: vendor.id,
            title: productTitle.trim(),
            slug: productSlug.trim().toLowerCase(),
            tagline: productTagline.trim() || null,
            description: productDescription.trim() || null,
            product_type: productType,
            price_cents: priceCents,
            currency: "BDT",
            status: productStatus,
            thumbnail_url: thumbnailUrl,
            metadata: { features: featureList },
            is_featured: true,
          },
        ])
        .select()
        .single();

      if (pErr || !createdProd) throw new Error(pErr?.message || "Failed to create product in database.");

      // 4. Upload software package file if provided
      if (softwareFile) {
        const cleanSlug = productSlug.trim().toLowerCase();
        const pkgExt = softwareFile.name.split(".").pop() || "zxp";
        const pkgPath = `releases/${cleanSlug}-${initialVersion.trim()}.${pkgExt}`;

        const pkgUpload = await insforge.storage.from("software-packages").upload(pkgPath, softwareFile);
        if (pkgUpload.error) {
          console.warn("Package upload warning:", pkgUpload.error);
        }

        // 5. Register software release linked to product
        await insforge.database.from("software_releases").insert([
          {
            product_id: createdProd.id,
            version_str: initialVersion.trim(),
            storage_path: pkgPath,
            changelog: "Initial release package",
            min_host_version: minHostVersion.trim() || null,
            file_size_bytes: softwareFile.size,
            is_active: true,
          },
        ]);
      }

      setFeedback({
        type: "success",
        message: `Product "${productTitle}" and release files created successfully!`,
      });

      // Reset form
      setProductTitle("");
      setProductSlug("");
      setProductTagline("");
      setProductDescription("");
      setImageFile(null);
      setSoftwareFile(null);

      await loadData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Failed to create product.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Upload Additional Software Release
  const handleUploadRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseFile || !releaseProductId) {
      setFeedback({ type: "error", message: "Please select a target product and upload a package file." });
      return;
    }
    setActionLoading("upload_release");
    setFeedback(null);

    try {
      const selectedProd = products.find((p) => p.id === releaseProductId);
      const cleanSlug = selectedProd?.slug || "package";
      const pkgExt = releaseFile.name.split(".").pop() || "zxp";
      const pkgPath = `releases/${cleanSlug}-${releaseVersion.trim()}.${pkgExt}`;

      // Upload to private software-packages bucket
      const uploadRes = await insforge.storage.from("software-packages").upload(pkgPath, releaseFile);
      if (uploadRes.error) {
        throw new Error(uploadRes.error.message || "Failed to upload file to software-packages storage.");
      }

      // Register release in database
      const { error: rErr } = await insforge.database.from("software_releases").insert([
        {
          product_id: releaseProductId,
          version_str: releaseVersion.trim(),
          storage_path: pkgPath,
          changelog: releaseChangelog.trim() || null,
          min_host_version: releaseHostVer.trim() || null,
          file_size_bytes: releaseFile.size,
          is_active: true,
        },
      ]);

      if (rErr) throw new Error(rErr.message);

      setFeedback({
        type: "success",
        message: `Software release ${releaseVersion} uploaded and registered successfully!`,
      });

      setReleaseFile(null);
      setReleaseChangelog("");
      await loadData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Failed to register release.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Payment Review Handler
  const handleReviewPayment = async (submissionId: string, decision: "verified" | "rejected") => {
    setActionLoading(submissionId);
    setFeedback(null);

    try {
      const { error } = await insforge.database.rpc("verify_manual_payment", {
        p_submission_id: submissionId,
        p_decision: decision,
        p_admin_notes: `Admin manual review: ${decision} at ${new Date().toISOString()}`,
      });

      if (error) throw new Error(error.message);

      setFeedback({
        type: "success",
        message: `Payment successfully marked as ${decision.toUpperCase()}! Licenses issued.`,
      });
      await loadData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Failed to process payment review.",
      });
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

  // Admin access guard
  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-6">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">Administrator Access Required</h1>
        <p className="mt-2 text-sm text-zinc-400">
          This portal is restricted to authorized BEEEJOY store administrators.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition-all"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              Admin Portal
            </span>
            <span className="text-xs text-zinc-500">InsForge Storage & RLS Active</span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-white">BEEEJOY Store Administration</h1>
        </div>

        <button
          onClick={loadData}
          disabled={loadingData}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Global Action Feedback */}
      {feedback && (
        <div
          className={`mb-6 flex items-start gap-2.5 rounded-xl border p-4 text-xs ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4 mb-8">
        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "products"
              ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20"
              : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Software Products ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("releases")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "releases"
              ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20"
              : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
          }`}
        >
          <Upload className="h-4 w-4" />
          <span>Release Packages ({releases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "payments"
              ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20"
              : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Manual Payments ({pendingPayments.filter((p) => p.status === "submitted").length})</span>
        </button>

        <button
          onClick={() => setActiveTab("licenses")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "licenses"
              ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20"
              : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
          }`}
        >
          <Key className="h-4 w-4" />
          <span>Issued Licenses ({licenses.length})</span>
        </button>
      </div>

      {/* TAB 1: PRODUCT UPLOAD & MANAGEMENT */}
      {activeTab === "products" && (
        <div className="space-y-8">
          {/* Upload New Software Product */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="h-5 w-5 text-amber-400" />
              <h2 className="text-xl font-bold text-white">Upload New Software Product</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-6">
              Create a new product listing, upload its preview image, and attach the initial `.zxp` software binary.
            </p>

            <form onSubmit={handleCreateProduct} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={productTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. BEJOY SYSTEM ACTIVE"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">URL Slug *</label>
                <input
                  type="text"
                  required
                  value={productSlug}
                  onChange={(e) => setProductSlug(e.target.value)}
                  placeholder="e.g. bejoy-system-active"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Price (in BDT ৳) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={productPriceBdt}
                  onChange={(e) => setProductPriceBdt(e.target.value)}
                  placeholder="2499"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Product Type</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="cep_extension">Adobe Illustrator CEP Extension</option>
                  <option value="script">Automation Script (.jsx)</option>
                  <option value="standalone">Standalone Application</option>
                  <option value="plugin">Plugin (.aip)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">Short Tagline</label>
                <input
                  type="text"
                  value={productTagline}
                  onChange={(e) => setProductTagline(e.target.value)}
                  placeholder="e.g. High-performance tool orchestration and workflow accelerator for Illustrator"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">Full Description</label>
                <textarea
                  rows={3}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Describe the software capabilities, workflow benefits, and user requirements..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* File Upload 1: Product Thumbnail Image */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <label className="block text-xs font-semibold text-white mb-1">
                  Product Image / Thumbnail
                </label>
                <p className="text-[11px] text-zinc-500 mb-3">
                  Uploads to public-assets bucket for preview cards.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
                />
              </div>

              {/* File Upload 2: Software Package File */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <label className="block text-xs font-semibold text-white mb-1">
                  Software Binary File (.zxp, .zip, .jsx)
                </label>
                <p className="text-[11px] text-zinc-500 mb-3">
                  Stored securely in private software-packages bucket.
                </p>
                <input
                  type="file"
                  accept=".zxp,.zip,.jsx,.tar.gz"
                  onChange={(e) => setSoftwareFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Initial Version</label>
                <input
                  type="text"
                  value={initialVersion}
                  onChange={(e) => setInitialVersion(e.target.value)}
                  placeholder="v1.0.0"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Compatibility</label>
                <input
                  type="text"
                  value={minHostVersion}
                  onChange={(e) => setMinHostVersion(e.target.value)}
                  placeholder="Illustrator 2024 (28.0+)"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={actionLoading === "create_product"}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all"
                >
                  {actionLoading === "create_product" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Upload & Publish Software Product</span>
                </button>
              </div>
            </form>
          </div>

          {/* Existing Products List */}
          <div>
            <h3 className="text-base font-bold text-white mb-4">Catalog Products ({products.length})</h3>
            {products.length === 0 ? (
              <p className="text-xs text-zinc-500">No products uploaded to database yet.</p>
            ) : (
              <div className="grid gap-3">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{p.title}</span>
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400">
                          {p.slug}
                        </span>
                        <span className="text-[10px] text-zinc-500 uppercase">{p.product_type}</span>
                      </div>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">{p.tagline}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="font-bold text-amber-400 text-sm">
                          ৳ {(p.price_cents / 100).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-zinc-500 block uppercase">{p.status}</span>
                      </div>

                      <Link
                        href={`/products/${p.slug}`}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:text-white transition-colors"
                      >
                        View Page
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RELEASE PACKAGES & BINARY UPLOADS */}
      {activeTab === "releases" && (
        <div className="space-y-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-2">Upload Software Release Package</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Attach a new versioned binary package (`.zxp`, `.zip`, `.jsx`) to an existing software product.
            </p>

            <form onSubmit={handleUploadRelease} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Target Product *</label>
                <select
                  required
                  value={releaseProductId}
                  onChange={(e) => setReleaseProductId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Version String *</label>
                <input
                  type="text"
                  required
                  value={releaseVersion}
                  onChange={(e) => setReleaseVersion(e.target.value)}
                  placeholder="v1.1.0"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Select Software Binary File (.zxp / .zip) *
                </label>
                <input
                  type="file"
                  required
                  accept=".zxp,.zip,.jsx"
                  onChange={(e) => setReleaseFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Host Compatibility
                </label>
                <input
                  type="text"
                  value={releaseHostVer}
                  onChange={(e) => setReleaseHostVer(e.target.value)}
                  placeholder="Illustrator 2024+"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Changelog</label>
                <input
                  type="text"
                  value={releaseChangelog}
                  onChange={(e) => setReleaseChangelog(e.target.value)}
                  placeholder="Fix performance, batch export enhancements..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={actionLoading === "upload_release"}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all"
                >
                  {actionLoading === "upload_release" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span>Upload Release to Private Storage</span>
                </button>
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-base font-bold text-white mb-4">Registered Packages ({releases.length})</h3>
            {releases.length === 0 ? (
              <p className="text-xs text-zinc-500">No software releases registered yet.</p>
            ) : (
              <div className="grid gap-3">
                {releases.map((rel) => (
                  <div
                    key={rel.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{rel.products?.title}</span>
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400">
                          {rel.version_str}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500 block mt-0.5">
                        Private Key: {rel.storage_path}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-emerald-400 font-semibold">Protected</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENTS REVIEW */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Manual Payment Submissions</h2>
            <p className="text-xs text-zinc-400">
              Review bKash and Nagad transaction references and issue licenses securely.
            </p>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-400 text-xs">
              No manual payment submissions found in database.
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingPayments.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">
                          Order: {sub.orders?.order_number || "ORD-XXXX"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            sub.status === "verified"
                              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : sub.status === "rejected"
                              ? "border border-rose-500/30 bg-rose-500/10 text-rose-400"
                              : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 block mt-1">
                        Submitted: {new Date(sub.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xl font-black text-amber-400">
                        ৳ {sub.orders ? (sub.orders.total_amount_cents / 100).toLocaleString() : "2,499"}
                      </span>
                      <span className="text-[10px] text-zinc-500 block uppercase">
                        Channel: {sub.payment_channel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                      <span className="text-[10px] text-zinc-500 block">Sender Account / Mobile</span>
                      <span className="font-mono font-semibold text-white">{sub.sender_identifier}</span>
                    </div>

                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                      <span className="text-[10px] text-zinc-500 block">Transaction Reference (TrxID)</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {sub.transaction_ref}
                      </span>
                    </div>
                  </div>

                  {sub.status === "submitted" && (
                    <div className="mt-6 flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => handleReviewPayment(sub.id, "rejected")}
                        disabled={actionLoading === sub.id}
                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition-all"
                      >
                        Reject
                      </button>

                      <button
                        onClick={() => handleReviewPayment(sub.id, "verified")}
                        disabled={actionLoading === sub.id}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all"
                      >
                        {actionLoading === sub.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        <span>Approve & Issue License</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LICENSES AUDIT */}
      {activeTab === "licenses" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">All Issued Customer Licenses</h2>
            <p className="text-xs text-zinc-400">
              Audit all minted server licenses, machine quotas, and status.
            </p>
          </div>

          {licenses.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-400 text-xs">
              No customer licenses issued yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {licenses.map((lic) => (
                <div
                  key={lic.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{lic.products?.title}</span>
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {lic.key_prefix}-••••-••••
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 block mt-1">
                      Customer ID: {lic.customer_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs font-bold text-white">
                        {lic.current_activations} / {lic.max_activations} Machines
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        Grace: {lic.grace_period_days} Days
                      </span>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        lic.status === "active"
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border border-rose-500/30 bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {lic.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
