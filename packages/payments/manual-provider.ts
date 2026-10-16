// ==============================================================================
// BEEEJOY Manual Payment Provider (bKash, Nagad, Bank Transfer)
// Handles offline payments with sender reference and transaction ID verification.
// ==============================================================================

import {
  IPaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentMethodType,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "./types.ts";

export interface ManualChannelConfig {
  accountNumber: string;
  accountType: "personal" | "merchant" | "agent";
  instructions: string;
}

export class BkashManualProvider implements IPaymentProvider {
  readonly providerId: PaymentMethodType = "bkash_manual";
  readonly isManual = true;

  constructor(private config: ManualChannelConfig) {}

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    return {
      success: true,
      requiresRedirect: false,
      instructions: {
        channel: "bKash",
        accountNumber: this.config.accountNumber,
        accountType: this.config.accountType,
        reference: params.orderNumber,
        submissionFormNeeded: true,
      },
    };
  }

  async verify(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    // Manual verification is governed by admin review workflow (never marked paid automatically)
    if (!params.manualSubmission?.transactionRef) {
      return {
        verified: false,
        status: "pending_payment",
        error: "Missing transaction reference",
      };
    }

    return {
      verified: false,
      status: "under_review",
      providerReference: params.manualSubmission.transactionRef,
    };
  }
}

export class NagadManualProvider implements IPaymentProvider {
  readonly providerId: PaymentMethodType = "nagad_manual";
  readonly isManual = true;

  constructor(private config: ManualChannelConfig) {}

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    return {
      success: true,
      requiresRedirect: false,
      instructions: {
        channel: "Nagad",
        accountNumber: this.config.accountNumber,
        accountType: this.config.accountType,
        reference: params.orderNumber,
        submissionFormNeeded: true,
      },
    };
  }

  async verify(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    if (!params.manualSubmission?.transactionRef) {
      return {
        verified: false,
        status: "pending_payment",
        error: "Missing transaction reference",
      };
    }

    return {
      verified: false,
      status: "under_review",
      providerReference: params.manualSubmission.transactionRef,
    };
  }
}

export class BankManualProvider implements IPaymentProvider {
  readonly providerId: PaymentMethodType = "bank_manual";
  readonly isManual = true;

  constructor(private config: ManualChannelConfig) {}

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    return {
      success: true,
      requiresRedirect: false,
      instructions: {
        channel: "Bank Transfer",
        accountNumber: this.config.accountNumber,
        accountType: this.config.accountType,
        reference: params.orderNumber,
        submissionFormNeeded: true,
      },
    };
  }

  async verify(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    if (!params.manualSubmission?.transactionRef) {
      return {
        verified: false,
        status: "pending_payment",
        error: "Missing deposit slip / transaction reference",
      };
    }

    return {
      verified: false,
      status: "under_review",
      providerReference: params.manualSubmission.transactionRef,
    };
  }
}
