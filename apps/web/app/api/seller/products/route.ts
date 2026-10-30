import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSeller } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedSeller(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Access denied. Active seller account required." },
        { status: 403 }
      );
    }

    const { data: products, error } = await auth.adminDb.database
      .from("products")
      .select("*, software_releases(id, version_str, storage_path, file_size_bytes, is_active)")
      .eq("vendor_id", auth.vendor.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: products || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedSeller(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Access denied. Active seller account required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const rawSlug = typeof body.slug === "string" ? body.slug.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const productType = body.productType === "premium" ? "premium" : "free";
    const priceBdtStr = String(body.priceBdt || "0").trim();
    const rawWhatsApp = typeof body.whatsappNumber === "string" ? body.whatsappNumber.trim() : "";
    const youtubeUrl = typeof body.youtubeUrl === "string" ? body.youtubeUrl.trim() : "";
    const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.trim() : null;
    const zipStoragePath = typeof body.zipStoragePath === "string" ? body.zipStoragePath.trim() : null;
    const zipSize = typeof body.zipSize === "number" ? body.zipSize : null;

    if (!title) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }

    const cleanSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug || cleanSlug.length < 2) {
      return NextResponse.json({ error: "Valid product slug is required" }, { status: 400 });
    }

    // Check slug uniqueness
    const { data: slugExisting } = await auth.adminDb.database
      .from("products")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (slugExisting) {
      return NextResponse.json(
        { error: `The product slug "${cleanSlug}" is already taken.` },
        { status: 409 }
      );
    }

    // WhatsApp & Price Validation
    const cleanWhatsApp = rawWhatsApp.replace(/[\s\+\-\(\)]/g, "").trim();
    let priceCents = 0;

    if (productType === "premium") {
      const parsedPrice = parseFloat(priceBdtStr);
      if (!priceBdtStr || isNaN(parsedPrice) || parsedPrice <= 0) {
        return NextResponse.json(
          { error: "Please enter a valid price (greater than 0) for Premium software." },
          { status: 400 }
        );
      }
      if (!cleanWhatsApp || !/^[0-9]{7,15}$/.test(cleanWhatsApp)) {
        return NextResponse.json(
          { error: "WhatsApp contact number (7-15 digits) is required for Premium software." },
          { status: 400 }
        );
      }
      priceCents = Math.round(parsedPrice * 100);
    } else {
      if (cleanWhatsApp && !/^[0-9]{7,15}$/.test(cleanWhatsApp)) {
        return NextResponse.json(
          { error: "Please enter a valid international WhatsApp number (7-15 digits) or leave it empty." },
          { status: 400 }
        );
      }
    }

    const metadataPayload: Record<string, any> = {};
    if (youtubeUrl) metadataPayload.youtube_url = youtubeUrl;
    if (cleanWhatsApp) metadataPayload.whatsapp_number = cleanWhatsApp;

    // Strict Security:
    // 1. Force vendor_id to authenticated seller's vendor.id
    // 2. Force status to 'pending_review' (seller CANNOT publish)
    const { data: newProduct, error: prodErr } = await auth.adminDb.database
      .from("products")
      .insert([
        {
          vendor_id: auth.vendor.id,
          title,
          slug: cleanSlug,
          description: description || null,
          product_type: productType,
          price_cents: priceCents,
          currency: "BDT",
          status: "pending_review",
          thumbnail_url: thumbnailUrl,
          metadata: metadataPayload,
          is_featured: false,
        },
      ])
      .select()
      .single();

    if (prodErr || !newProduct) {
      return NextResponse.json(
        { error: prodErr?.message || "Failed to create product record" },
        { status: 500 }
      );
    }

    // Attach software release if ZIP path was provided
    if (zipStoragePath) {
      await auth.adminDb.database.from("software_releases").insert([
        {
          product_id: newProduct.id,
          version_str: "v1.0.0",
          storage_path: zipStoragePath,
          changelog: "Initial release package",
          file_size_bytes: zipSize,
          is_active: true,
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      message: "Product submitted successfully! It is now Pending Review by Admin.",
      product: newProduct,
    });
  } catch (err: any) {
    console.error("Seller create product error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthenticatedSeller(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Access denied. Active seller account required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const productId = typeof body.id === "string" ? body.id : "";

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Verify product exists and is owned by this seller
    const { data: existingProd, error: findErr } = await auth.adminDb.database
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (findErr || !existingProd) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (existingProd.vendor_id !== auth.vendor.id) {
      return NextResponse.json(
        { error: "Access denied. You can only edit your own products." },
        { status: 403 }
      );
    }

    const title = typeof body.title === "string" ? body.title.trim() : existingProd.title;
    const rawSlug = typeof body.slug === "string" ? body.slug.trim() : existingProd.slug;
    const description = typeof body.description === "string" ? body.description.trim() : (existingProd.description || "");
    const productType = body.productType === "premium" ? "premium" : "free";
    const priceBdtStr = String(body.priceBdt ?? (existingProd.price_cents / 100)).trim();
    const rawWhatsApp = typeof body.whatsappNumber === "string" ? body.whatsappNumber.trim() : (existingProd.metadata?.whatsapp_number || "");
    const youtubeUrl = typeof body.youtubeUrl === "string" ? body.youtubeUrl.trim() : (existingProd.metadata?.youtube_url || "");
    const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.trim() : existingProd.thumbnail_url;
    const zipStoragePath = typeof body.zipStoragePath === "string" ? body.zipStoragePath.trim() : null;
    const zipSize = typeof body.zipSize === "number" ? body.zipSize : null;

    const cleanSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Check slug uniqueness if changed
    if (cleanSlug !== existingProd.slug) {
      const { data: slugExisting } = await auth.adminDb.database
        .from("products")
        .select("id")
        .eq("slug", cleanSlug)
        .neq("id", productId)
        .maybeSingle();

      if (slugExisting) {
        return NextResponse.json(
          { error: `The product slug "${cleanSlug}" is already taken.` },
          { status: 409 }
        );
      }
    }

    const cleanWhatsApp = rawWhatsApp.replace(/[\s\+\-\(\)]/g, "").trim();
    let priceCents = 0;

    if (productType === "premium") {
      const parsedPrice = parseFloat(priceBdtStr);
      if (!priceBdtStr || isNaN(parsedPrice) || parsedPrice <= 0) {
        return NextResponse.json(
          { error: "Please enter a valid price (greater than 0) for Premium software." },
          { status: 400 }
        );
      }
      if (!cleanWhatsApp || !/^[0-9]{7,15}$/.test(cleanWhatsApp)) {
        return NextResponse.json(
          { error: "WhatsApp contact number (7-15 digits) is required for Premium software." },
          { status: 400 }
        );
      }
      priceCents = Math.round(parsedPrice * 100);
    } else {
      if (cleanWhatsApp && !/^[0-9]{7,15}$/.test(cleanWhatsApp)) {
        return NextResponse.json(
          { error: "Please enter a valid international WhatsApp number (7-15 digits) or leave it empty." },
          { status: 400 }
        );
      }
    }

    const metadataPayload: Record<string, any> = {
      ...(existingProd.metadata || {}),
    };
    if (youtubeUrl) metadataPayload.youtube_url = youtubeUrl;
    else delete metadataPayload.youtube_url;

    if (cleanWhatsApp) metadataPayload.whatsapp_number = cleanWhatsApp;
    else delete metadataPayload.whatsapp_number;

    // Notice: Any edit by seller resubmits product to 'pending_review'
    // Sellers CANNOT keep or set 'published' themselves
    const { data: updatedProduct, error: updErr } = await auth.adminDb.database
      .from("products")
      .update({
        title,
        slug: cleanSlug,
        description: description || null,
        product_type: productType,
        price_cents: priceCents,
        status: "pending_review",
        thumbnail_url: thumbnailUrl,
        metadata: metadataPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .select()
      .single();

    if (updErr || !updatedProduct) {
      return NextResponse.json(
        { error: updErr?.message || "Failed to update product" },
        { status: 500 }
      );
    }

    // If new zip uploaded, update active software release
    if (zipStoragePath) {
      await auth.adminDb.database
        .from("software_releases")
        .update({ is_active: false })
        .eq("product_id", productId);

      await auth.adminDb.database.from("software_releases").insert([
        {
          product_id: productId,
          version_str: "v1.0.1",
          storage_path: zipStoragePath,
          changelog: "Updated product release package",
          file_size_bytes: zipSize,
          is_active: true,
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      message: "Product updated and resubmitted for Admin review.",
      product: updatedProduct,
    });
  } catch (err: any) {
    console.error("Seller update product error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
