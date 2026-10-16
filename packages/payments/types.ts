// ==============================================================================
// BEEEJOY Modular Payment Provider Interface
// Allows swapping or adding payment gateways (bKash/Nagad manual, SSLCommerz,
// AamarPay, Stripe) without altering core order or licensing systems.
// ==============================================================================

export type PaymentMethodType =
  | "bkash_manual"
  | "nagad_manual"
  | "bank_manual"
  | "sslcommerz"
  | "aamarpay";

export type PaymentLifecycleStatus =
  | "pending_payment"
  | "under_review"
  | "completed"
  | "cancelled"
  | "failed"
  | "refunded";

export interface InitiatePaymentParams {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  customer: {
    id: string;
    email: string;
    name?: string;
    phone?: string;
  };
  productTitles: string[];
  callbackUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResult {
  success: boolean;
  requiresRedirect: boolean;
  redirectUrl?: string;
  instructions?: {
    channel: string;
    accountNumber: string;
    accountType: "personal" | "merchant" | "agent";
    reference: string;
    submissionFormNeeded: boolean;
  };
  providerTransactionId?: string;
  error?: string;
}

export interface VerifyPaymentParams {
  orderId: string;
  providerTransactionId?: string;
  manualSubmission?: {
    channel: "bkash" | "nagad" | "bank";
    senderIdentifier: string;
    transactionRef: string;
    receiptStoragePath?: string;
  };
  rawPayload?: Record<string, unknown>;
}

export interface VerifyPaymentResult {
  verified: boolean;
  status: PaymentLifecycleStatus;
  providerReference?: string;
  error?: string;
}

/**
 * Standard contract for any payment provider integration.
 */
export interface IPaymentProvider {
  readonly providerId: PaymentMethodType;
  readonly isManual: boolean;

  initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  verify(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
}
