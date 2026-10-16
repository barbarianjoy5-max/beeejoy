// ==============================================================================
// BEEEJOY Payments Registry & Factory
// ==============================================================================

export * from "./types.ts";
export * from "./manual-provider.ts";
export * from "./sslcommerz-provider.ts";
export * from "./aamarpay-provider.ts";

import {
  BkashManualProvider,
  NagadManualProvider,
  BankManualProvider,
} from "./manual-provider.ts";
import { SSLCommerzProvider } from "./sslcommerz-provider.ts";
import { AamarPayProvider } from "./aamarpay-provider.ts";
import { IPaymentProvider, PaymentMethodType } from "./types.ts";

export interface PaymentSystemConfig {
  bkash?: { accountNumber: string; accountType: "personal" | "merchant" | "agent"; instructions: string };
  nagad?: { accountNumber: string; accountType: "personal" | "merchant" | "agent"; instructions: string };
  bank?: { accountNumber: string; accountType: "personal" | "merchant" | "agent"; instructions: string };
  sslcommerz?: { storeId?: string; storePassword?: string; isSandbox?: boolean };
  aamarpay?: { storeId?: string; signatureKey?: string; isSandbox?: boolean };
}

export class PaymentProviderFactory {
  static getProvider(method: PaymentMethodType, config: PaymentSystemConfig): IPaymentProvider {
    switch (method) {
      case "bkash_manual":
        return new BkashManualProvider(
          config.bkash || {
            accountNumber: "01XXXXXXXXX",
            accountType: "personal",
            instructions: "Send Money to our bKash personal number and enter your Transaction ID (TrxID) below.",
          }
        );
      case "nagad_manual":
        return new NagadManualProvider(
          config.nagad || {
            accountNumber: "01XXXXXXXXX",
            accountType: "personal",
            instructions: "Send Money to our Nagad personal number and enter your Transaction ID (TrxID) below.",
          }
        );
      case "bank_manual":
        return new BankManualProvider(
          config.bank || {
            accountNumber: "XXXX-XXXX-XXXX-XXXX",
            accountType: "personal",
            instructions: "Transfer to our Bank Account and attach your deposit slip or transaction reference.",
          }
        );
      case "sslcommerz":
        return new SSLCommerzProvider(config.sslcommerz);
      case "aamarpay":
        return new AamarPayProvider(config.aamarpay);
      default:
        throw new Error(`Unsupported payment method: ${method}`);
    }
  }
}
