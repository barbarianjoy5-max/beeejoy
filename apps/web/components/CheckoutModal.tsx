"use client";

import React, { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { insforge } from "../lib/insforge";
import { X, CheckCircle2, AlertCircle, Loader2, CreditCard, ShieldCheck, Copy, Check } from "lucide-react";
import Link from "next/link";

export interface CheckoutProduct {
  id?: string;
  vendor_id?: string;
  title: string;
  slug: string;
  price: string;
  price_cents: number;
  category?: string;
}

interface CheckoutModalProps {
  product: CheckoutProduct | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckoutModal({ product, isOpen, onClose }: CheckoutModalProps) {
  const { user, openAuthModal } = useAuth();
  const [paymentChannel, setPaymentChannel] = useState<"bkash" | "nagad" | "bank">("bkash");
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string; orderId: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const accounts = {
    bkash: {
      name: "bKash Personal",
      number: "01876603607",
      type: "Send Money",
      instructions: "Go to your bKash app -> Send Money -> Enter number -> Enter amount -> Save TrxID.",
    },
    nagad: {
      name: "Nagad Personal",
      number: "01822-445566",
      type: "Send Money",
      instructions: "Go to your Nagad app -> Send Money -> Enter number -> Enter amount -> Save TrxID.",
    },
    bank: {
      name: "Dutch-Bangla Bank PLC",
      number: "1641570006797",
      accountNumber: "1641570006797",
      routingNumber: "090263136",
      swiftCode: "DBBLBDDH164",
      instructions: "Transfer via BEFTN, NPSB, DBBL Rocket or Branch -> Enter Trx/Deposit Ref below.",
    },
  };

  const currentAccount = accounts[paymentChannel];

  const handleCopy = (text: string, key: string = "default") => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      const dbPaymentMethod =
        paymentChannel === "bkash"
          ? "bkash_manual"
          : paymentChannel === "nagad"
          ? "nagad_manual"
          : "bank_manual";

      // 1. Create order record
      const { data: orderData, error: orderErr } = await insforge.database
        .from("orders")
        .insert([
          {
            order_number: orderNumber,
            customer_id: user.id,
            total_amount_cents: product.price_cents,
            currency: "BDT",
            payment_method: dbPaymentMethod,
            status: "pending_payment",
            notes: notes.trim() || null,
          },
        ])
        .select()
        .single();

      if (orderErr || !orderData) {
        throw new Error(orderErr?.message || "Could not create order. Please try again.");
      }

      const createdOrderId = orderData.id;

      // 2. Link order item if valid product exists in database
      if (product.id && product.vendor_id) {
        await insforge.database.from("order_items").insert([
          {
            order_id: createdOrderId,
            product_id: product.id,
            vendor_id: product.vendor_id,
            unit_price_cents: product.price_cents,
          },
        ]);
      }

      // 3. Submit manual payment verification record
      const { error: subErr } = await insforge.database
        .from("manual_payment_submissions")
        .insert([
          {
            order_id: createdOrderId,
            payment_channel: paymentChannel,
            sender_identifier: senderNumber.trim(),
            transaction_ref: trxId.trim().toUpperCase(),
            status: "submitted",
          },
        ]);

      if (subErr) {
        throw new Error(subErr.message || "Failed to submit payment details.");
      }

      setOrderSuccess({ orderNumber, orderId: createdOrderId });
    } catch (err: any) {
      console.error("Order submission error:", err);
      setError(err?.message || "Order processing failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 p-8 shadow-2xl shadow-black/80"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {!user ? (
          /* Unauthenticated State */
          <div className="text-center py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Sign In Required</h3>
            <p className="mt-2 text-xs text-zinc-400 max-w-sm mx-auto">
              Please sign in or create a BEEEJOY account so your license key can be permanently tied to your account.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => {
                  onClose();
                  openAuthModal("signin");
                }}
                className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  onClose();
                  openAuthModal("signup");
                }}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-6 py-2.5 text-xs font-semibold text-zinc-200 hover:text-white transition-all"
              >
                Create Account
              </button>
            </div>
          </div>
        ) : orderSuccess ? (
          /* Order Confirmation State */
          <div className="text-center py-6 animate-in fade-in zoom-in-95">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              Order Placed: {orderSuccess.orderNumber}
            </span>
            <h3 className="mt-4 text-2xl font-black text-white">Payment Under Review</h3>
            <p className="mt-2 text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              We received your <span className="text-amber-400 font-semibold">{paymentChannel.toUpperCase()}</span> transaction details. Our verification team will verify the payment and generate your license key within minutes.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/account/orders"
                onClick={onClose}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 text-center transition-all"
              >
                View Order Status
              </Link>
              <Link
                href="/account/licenses"
                onClick={onClose}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-xs font-semibold text-zinc-200 hover:text-white text-center transition-all"
              >
                Go to My Licenses
              </Link>
            </div>
          </div>
        ) : (
          /* Checkout Form */
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Purchase License</h3>
                <p className="text-xs text-zinc-400">Manual verification via bKash / Nagad</p>
              </div>
            </div>

            {/* Product summary card */}
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{product.title}</h4>
                  <p className="text-[11px] text-zinc-400">{product.category || "Adobe Illustrator Extension"}</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-amber-400">{product.price}</span>
                  <span className="text-[10px] text-zinc-500 block">Single License</span>
                </div>
              </div>
            </div>

            {/* Payment channel selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-300 mb-2">
                Select Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["bkash", "nagad", "bank"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentChannel(method)}
                    className={`rounded-xl border py-2 text-xs font-bold transition-all ${
                      paymentChannel === method
                        ? "border-amber-500 bg-amber-500/10 text-amber-400 shadow-sm"
                        : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                    }`}
                  >
                    {method === "bank" ? "Dutch-Bangla Bank" : method === "bkash" ? "bKash" : "Nagad"}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Info Box */}
            <div className="mb-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
              {paymentChannel === "bank" ? (
                <div className="space-y-2.5">
                  <div className="border-b border-zinc-800/80 pb-2">
                    <span className="text-[11px] font-medium text-zinc-500">Bank Name</span>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {accounts.bank.name}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-zinc-500">Account Number</span>
                      <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                        {accounts.bank.accountNumber}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(accounts.bank.accountNumber, "bank_acc")}
                      className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white transition-colors"
                    >
                      {copiedKey === "bank_acc" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === "bank_acc" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-zinc-500">Routing Number</span>
                      <div className="text-xs font-bold font-mono text-zinc-200 mt-0.5">
                        {accounts.bank.routingNumber}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(accounts.bank.routingNumber, "bank_routing")}
                      className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white transition-colors"
                    >
                      {copiedKey === "bank_routing" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === "bank_routing" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-zinc-500">SWIFT Code</span>
                      <div className="text-xs font-bold font-mono text-zinc-200 mt-0.5">
                        {accounts.bank.swiftCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(accounts.bank.swiftCode, "bank_swift")}
                      className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white transition-colors"
                    >
                      {copiedKey === "bank_swift" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === "bank_swift" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <p className="pt-1 text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-800/80">
                    {accounts.bank.instructions}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-zinc-500">{currentAccount.name}</span>
                      <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                        {currentAccount.number}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentAccount.number.replace(/-/g, ""), "mobile")}
                      className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white transition-colors"
                    >
                      {copiedKey === "mobile" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === "mobile" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-800/80 pt-2">
                    {currentAccount.instructions}
                  </p>
                </>
              )}
            </div>

            {/* Submission Error */}
            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Sender Mobile / Account Number *
                </label>
                <input
                  type="text"
                  required
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Transaction ID (TrxID / Reference) *
                </label>
                <input
                  type="text"
                  required
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="e.g. 9JH76T4QA1"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none uppercase transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Time of payment, special instructions, etc."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting Order...</span>
                  </>
                ) : (
                  <span>Submit Payment for Verification</span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
