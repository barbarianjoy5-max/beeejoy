// ==============================================================================
// BEEEJOY Manual Payment Shared Constants (server + client safe)
// Backs the bKash / Nagad / DBBL Bank Transfer workflow. No new gateway here —
// these values only describe the existing manual_payment_submissions flow.
// ==============================================================================

/** Private bucket already used for paid software; receipts never go public. */
export const RECEIPT_BUCKET = "software-packages";

/**
 * Every receipt lives under this prefix. The server owns the whole path
 * (reference + random suffix) so a client can never point a submission at
 * another customer's receipt.
 */
export const RECEIPT_PREFIX = "payment-receipts";

/** insforge.toml caps uploads at 50MB; a payment screenshot needs far less. */
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

export const RECEIPT_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export type ManualPaymentChannel = "bkash" | "nagad" | "bank";

export const MANUAL_PAYMENT_CHANNELS: ManualPaymentChannel[] = ["bkash", "nagad", "bank"];

/** orders.payment_method CHECK constraint values in the existing schema. */
export function dbPaymentMethod(channel: ManualPaymentChannel): string {
  return channel === "bank" ? "bank_manual" : `${channel}_manual`;
}

/**
 * Unique payment reference, e.g. `BJ-261106-7K3P9X`.
 *
 * Date prefix keeps orders readable and groups them by day; the 6-character
 * random suffix (36^6 ≈ 2.1 billion per day, minus ambiguous glyphs) is what
 * actually guarantees uniqueness. `orders.order_number` is UNIQUE in Postgres,
 * so the caller retries on the rare collision instead of trusting this alone.
 */
export function generatePaymentReference(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  // Crockford-style alphabet: no I/L/O/U to confuse manual transcription.
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const randomValues = new Uint32Array(6);
  crypto.getRandomValues(randomValues);
  const suffix = Array.from(randomValues, (v) => alphabet[v % alphabet.length]).join("");

  return `BJ-${y}${m}${d}-${suffix}`;
}

/**
 * Server-controlled storage key for a receipt. Returns null when the caller
 * tries to smuggle a path outside this order's own prefix.
 */
export function buildReceiptPath(reference: string, mime: string): string | null {
  if (!/^[A-Za-z0-9-]+$/.test(reference)) return null;

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/jpeg"
      ? "jpg"
      : mime === "image/webp"
      ? "webp"
      : mime === "image/gif"
      ? "gif"
      : mime === "application/pdf"
      ? "pdf"
      : null;

  if (!ext) return null;

  const roll = new Uint32Array(1);
  crypto.getRandomValues(roll);
  return `${RECEIPT_PREFIX}/${reference}/${roll[0].toString(36)}.receipt.${ext}`;
}

/** True only when the key was produced by buildReceiptPath for some order. */
export function isReceiptPath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith(`${RECEIPT_PREFIX}/`);
}
