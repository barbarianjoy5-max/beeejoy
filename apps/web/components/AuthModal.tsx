"use client";

import React, { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { X, Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalMode, openAuthModal, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (authModalMode === "signin") {
        const res = await signIn(email, password);
        if (!res.success) {
          setError(res.error || "Failed to sign in. Please check your credentials.");
        }
      } else {
        const res = await signUp(email, password, fullName);
        if (!res.success) {
          setError(res.error || "Failed to create account.");
        } else if (res.requireVerification) {
          setSuccessMessage("Account created! Please check your email for the verification code.");
        }
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 p-8 shadow-2xl shadow-black/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient effect */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 font-black text-zinc-950 shadow-md shadow-amber-500/20">
            B
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {authModalMode === "signin" ? "Sign In to BEEEJOY" : "Create Your Account"}
            </h3>
            <p className="text-xs text-zinc-400">
              Access your software licenses, activations, and downloads.
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-zinc-950/80 p-1 mb-6 border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccessMessage(null);
              openAuthModal("signin");
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              authModalMode === "signin"
                ? "bg-amber-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccessMessage(null);
              openAuthModal("signup");
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              authModalMode === "signup"
                ? "bg-amber-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authModalMode === "signup" && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Joy Rahman"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none transition-colors"
            />
            {authModalMode === "signup" && (
              <p className="mt-1 text-[11px] text-zinc-500">Minimum 6 characters</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{authModalMode === "signin" ? "Sign In" : "Register Account"}</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-[11px] text-zinc-500">
          Secured with InsForge Authentication & Postgres RLS.
        </div>
      </div>
    </div>
  );
}
