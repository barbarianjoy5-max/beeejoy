// ==============================================================================
// BEEEJOY SSLCommerz Gateway Provider (Modular Skeleton)
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

export interface SSLCommerzConfig {
  storeId?: string;
  storePassword?: string;
  isSandbox?: boolean;
}

export class SSLCommerzProvider implements IPaymentProvider {
  readonly providerId: PaymentMethodType = "sslcommerz";
  readonly isManual = false;

  constructor(private config: SSLCommerzConfig = {}) {}

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (!this.config.storeId || !this.config.storePassword) {
      return {
        success: false,
        requiresRedirect: false,
        error: "SSLCommerz credentials are not yet configured. Please use manual payments.",
      };
    }

    // Planned: Call SSLCommerz Session API and return gateway redirect URL
    return {
      success: true,
      requiresRedirect: true,
      redirectUrl: `https://${this.config.isSandbox ? "sandbox" : "securepay"}.sslcommerz.com/gwprocess/v4/api.php?sessionkey=MOCK_PENDING_CONFIG`,
    };
  }

  async verify(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    if (!this.config.storeId || !this.config.storePassword) {
      return {
        verified: false,
        status: "pending_payment",
        error: "SSLCommerz credentials not configured",
      };
    }

    // Planned: Call SSLCommerz Order Validation API with val_id
    return {
      verified: false,
      status: "under_review",
    };
  }
}
