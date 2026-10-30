import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getUserClient } from "@/lib/insforge-server";

const SINGLE_ADMIN_UUID = "e2f6c2a3-a0e4-46bf-a13f-5b6d088f839d";

interface RouteParams {
  params: Promise<{ productId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // 1. Extract Bearer token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Authentication token required" },
        { status: 401 }
      );
    }

    // 2. Cryptographically verify user session through InsForge Auth server
    const userClient = getUserClient(token);
    const { data: userData, error: userErr } = await userClient.auth.getCurrentUser();

    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: "Invalid or expired session token" },
        { status: 401 }
      );
    }

    const authenticatedUser = userData.user;

    // 3. Strict Single Admin UUID check
    if (authenticatedUser.id !== SINGLE_ADMIN_UUID) {
      return NextResponse.json(
        { error: "Forbidden: Not authorized as Single Admin" },
        { status: 403 }
      );
    }

    // 4. Strict profile role check
    const adminDb = getAdminClient();
    const { data: profile, error: profErr } = await adminDb.database
      .from("profiles")
      .select("role")
      .eq("id", SINGLE_ADMIN_UUID)
      .maybeSingle();

    if (profErr || profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin role required" },
        { status: 403 }
      );
    }

    // 5. Query active release storage path
    const { data: release, error: relErr } = await adminDb.database
      .from("software_releases")
      .select("storage_path")
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (relErr || !release || !release.storage_path) {
      return NextResponse.json(
        { error: "No package file attached to this product" },
        { status: 404 }
      );
    }

    // 6. Generate 300s signed URL from private software-packages bucket
    const { data: signedData, error: signErr } = await adminDb.storage
      .from("software-packages")
      .createSignedUrl(release.storage_path, 300);

    if (signErr || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate download link" },
        { status: 500 }
      );
    }

    // Return the signed URL to the admin dashboard
    return NextResponse.json({ downloadUrl: signedData.signedUrl });
  } catch (err: any) {
    console.error("Admin download error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
