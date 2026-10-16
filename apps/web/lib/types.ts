// ==============================================================================
// BEEEJOY Domain Types & Data Contracts
// ==============================================================================

export type UserRole = "customer" | "vendor" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type ProductType = "cep_extension" | "script" | "standalone" | "plugin";
export type ProductStatus = "draft" | "pending_review" | "published" | "archived";

export interface Product {
  id: string;
  vendor_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  product_type: ProductType;
  price_cents: number;
  currency: string;
  status: ProductStatus;
  thumbnail_url: string | null;
  screenshots: string[];
  metadata: {
    min_illustrator_version?: string;
    max_illustrator_version?: string;
    cep_version?: string;
    os_compatibility?: string[];
    features?: string[];
  };
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface SoftwareRelease {
  id: string;
  product_id: string;
  version_str: string;
  changelog: string | null;
  storage_path: string;
  file_checksum_sha256: string | null;
  file_size_bytes: number | null;
  min_host_version: string | null;
  max_host_version: string | null;
  is_active: boolean;
  created_at: string;
}

export type OrderStatus =
  | "pending_payment"
  | "under_review"
  | "completed"
  | "cancelled"
  | "refunded";

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  total_amount_cents: number;
  currency: string;
  payment_method: string;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualPaymentSubmission {
  id: string;
  order_id: string;
  payment_channel: "bkash" | "nagad" | "bank";
  sender_identifier: string;
  transaction_ref: string;
  receipt_storage_path: string | null;
  status: "submitted" | "verified" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface SoftwareLicense {
  id: string;
  order_id: string;
  customer_id: string;
  product_id: string;
  key_prefix: string;
  status: "active" | "suspended" | "revoked" | "expired";
  max_activations: number;
  current_activations: number;
  grace_period_days: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
}
