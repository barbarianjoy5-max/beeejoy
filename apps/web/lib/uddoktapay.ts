import "server-only";

// ==============================================================================
// BEEEJOY UddoktaPay Server Client
// Server-only. Never import from client components.
// Base URL already includes /api — endpoints are appended once.
// ==============================================================================

const DEFAULT_BASE_URL = "https://beeejoy.paymently.io/api";

export interface UddoktaPayCheckoutPayload {
  full_name: string;
  email: string;
  amount: string;
  metadata: Record<string, string>;
  redirect_url: string;
  return_type: "GET" | "POST";
  cancel_url: string;
}

export interface UddoktaPayCheckoutResponse {
  status: boolean;
  message?: string;
  payment_url?: string;
}

export interface UddoktaPayVerifyResponse {
  full_name?: string;
  email?: string;
  amount?: string;
  fee?: string;
  charged_amount?: string;
  invoice_id?: string;
  metadata?: Record<string, any>;
  payment_method?: string;
  sender_number?: string;
  transaction_id?: string;
  date?: string;
  status?: string; // COMPLETED | PENDING | ERROR
  message?: string;
}

function getConfig() {
  const baseUrl = (process.env.UDDOKTAPAY_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const apiKey = process.env.UDDOKTAPAY_API_KEY;
  if (!apiKey) {
    throw new Error("UDDOKTAPAY_API_KEY is not configured.");
  }
  return { baseUrl, apiKey };
}

async function uddoktaPayPost<T>(path: string, body: Record<string, any>): Promise<T> {
  const { baseUrl, apiKey } = getConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "RT-UDDOKTAPAY-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as T & { message?: string };
  if (!res.ok) {
    throw new Error(data?.message || `UddoktaPay request failed (${res.status}).`);
  }
  return data as T;
}

export async function checkoutV2(payload: UddoktaPayCheckoutPayload): Promise<UddoktaPayCheckoutResponse> {
  return uddoktaPayPost<UddoktaPayCheckoutResponse>("/checkout-v2", payload as unknown as Record<string, any>);
}

export async function verifyPayment(invoiceId: string): Promise<UddoktaPayVerifyResponse> {
  return uddoktaPayPost<UddoktaPayVerifyResponse>("/verify-payment", { invoice_id: invoiceId });
}
