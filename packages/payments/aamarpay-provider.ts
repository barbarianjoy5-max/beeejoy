// ==============================================================================
// BEEEJOY AamarPay Gateway Provider (Modular Skeleton)
// Ready for live credentials and automated gateway activation once approved.
// ==============================================================================

import {
  IPaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentMethodType,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "./types.ts";

export interface AamarPayConfig {
  storeId?: string;
  signatureKey?: string;
  isSandbox?: boolean;
}

export class AamarPayProvider implements IPaymentProvider {
  readonly providerId: PaymentMethodType = "aamarpay";
  readonly isManual = false;

  constructor(private config: AamarPayConfig = {}) {}

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (!this.config.storeId || !this.config.signatureKey) {
      return {
        success: false,
        requiresRedirect: false,
        error: "AamarPay credentials are not yet configured. Please use manual payments.",
      };
    }

    // Planned: Call AamarPay initiation API and return payment page URL
    return {
      success: true,
      requiresRedirect: true,
      redirectUrl: `https://${this.config.isSandbox ? "sandbox" : "secure"}.aamarpay.com/request.php`,
    };
  }

  async verify(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    if (!this.config.storeId || !this.config.signatureKey) {
      return {
        verified: false,
        status: "pending_payment",
        error: "AamarPay credentials not configured",
      };
    }

    // Planned: Verify transaction via AamarPay verification endpoint
    return {
      verified: false,
      status: "under_review",
    };
  }
}
