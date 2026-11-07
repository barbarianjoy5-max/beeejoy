"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/auth-context";
import { X, Loader2, AlertCircle, CheckCircle2, Mail, ArrowLeft } from "lucide-react";

export default function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalMode,
    openAuthModal,
    signIn,
    signUp,
    verifyEmail,
    resendVerification,
    pendingVerificationEmail,
    setPendingVerificationEmail,
    signInWithGoogle,
  } = useAuth();

  const [view, setView] = useState<"signin" | "signup" | "verify">(authModalMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync view when modal opens or external mode changes
  useEffect(() => {
    if (isAuthModalOpen) {
      if (pendingVerificationEmail) {
        setView("verify");
      } else {
        setView(authModalMode);
      }
      setError(null);
      setSuccessMessage(null);
      setOtp("");
    }
  }, [authModalMode, isAuthModalOpen, pendingVerificationEmail]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendTimer = (seconds: number = 60) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendCooldown(seconds);
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (view === "signin") {
        const res = await signIn(email, password);
        if (res.requireVerification) {
          setView("verify");
          setOtp("");
          setError(null);
          setSuccessMessage("Please enter the 6-digit verification code sent to your email.");
          startResendTimer(60);
        } else if (!res.success) {
          setError(res.error || "Failed to sign in. Please check your credentials.");
        }
      } else if (view === "signup") {
        const res = await signUp(email, password, fullName);
        if (res.requireVerification) {
          setView("verify");
          setOtp("");
          setError(null);
          setSuccessMessage("Account created! A 6-digit verification code was sent to your email.");
          startResendTimer(60);
        } else if (!res.success) {
          setError(res.error || "Failed to create account.");
        }
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    const targetEmail = pendingVerificationEmail || email;
    if (!targetEmail) {
      setError("Email address not found. Please re-enter your details.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await verifyEmail(targetEmail, cleanOtp);
      if (!res.success) {
        setError(res.error || "Invalid verification code. Please check and try again.");
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setOtp("");
      }
    } catch (err: any) {
      setError(err?.message || "Verification failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;

    const targetEmail = pendingVerificationEmail || email;
    if (!targetEmail) {
      setError("Email address missing. Please return to registration.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsResending(true);

    try {
      const res = await resendVerification(targetEmail);
      if (!res.success) {
        setError(res.error || "Failed to resend verification code.");
      } else {
        setSuccessMessage(res.message || "A new 6-digit verification code has been sent to your email.");
        startResendTimer(60);
      }
    } catch (err: any) {
      setError(err?.message || "Could not resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const handleChangeEmail = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendCooldown(0);
    setError(null);
    setSuccessMessage(null);
    setOtp("");
    setPendingVerificationEmail(null);
    setView("signup");
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        setError(res.error || "Google sign in failed. Please try again.");
      }
      // On success the browser will redirect to Google — no further action needed.
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsGoogleSubmitting(false);
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
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 font-black text-zinc-950 shadow-md shadow-amber-500/20">
            {view === "verify" ? <Mail className="h-5 w-5 text-zinc-950" /> : "B"}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {view === "verify"
                ? "Verify Your Email"
                : view === "signin"
                ? "Sign In to BEEEJOY"
                : "Create Your Account"}
            </h3>
            <p className="text-xs text-zinc-400">
              {view === "verify" ? (
                <>
                  Enter the code sent to{" "}
                  <span className="font-semibold text-amber-400">
                    {pendingVerificationEmail || email}
                  </span>
                </>
              ) : (
                "Access your software licenses, activations, and downloads."
              )}
            </p>
          </div>
        </div>

        {/* Tab switch (only visible in signin / signup views) */}
        {view !== "verify" && (
          <div className="flex rounded-xl bg-zinc-950/80 p-1 mb-6 border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSuccessMessage(null);
                setView("signin");
                openAuthModal("signin");
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                view === "signin"
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
                setView("signup");
                openAuthModal("signup");
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                view === "signup"
                  ? "bg-amber-500 text-zinc-950 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>
        )}

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

        {/* VIEW 1: EMAIL OTP VERIFICATION */}
        {view === "verify" ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2 text-center">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                required
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtp(val);
                  setError(null);
                }}
                placeholder="••••••"
                className="w-full text-center text-2xl font-mono tracking-[0.35em] font-bold rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-amber-400 placeholder-zinc-700 focus:border-amber-500 focus:outline-none transition-colors"
              />
              <p className="mt-2 text-center text-[11px] text-zinc-500">
                Check your Gmail inbox and spam/junk folder
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify & Sign In</span>
              )}
            </button>

            {/* Resend and Change Email controls */}
            <div className="pt-3 border-t border-zinc-800/80 flex flex-col items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <span>Didn&apos;t receive the code?</span>
                {resendCooldown > 0 ? (
                  <span className="font-mono text-zinc-500 font-medium">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isResending}
                    className="font-semibold text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isResending ? "Sending..." : "Resend Code"}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Change email address</span>
                </button>
                <span className="text-zinc-700">&bull;</span>
                <button
                  type="button"
                  onClick={() => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setResendCooldown(0);
                    setError(null);
                    setSuccessMessage(null);
                    setOtp("");
                    setPendingVerificationEmail(null);
                    setView("signin");
                  }}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* VIEW 2: SIGN IN / SIGN UP FORMS */
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {view === "signup" && (
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
                {view === "signup" && (
                  <p className="mt-1 text-[11px] text-zinc-500">Minimum 6 characters</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{view === "signin" ? "Sign In" : "Register Account"}</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-[11px] text-zinc-500">or continue with</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isSubmitting}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isGoogleSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span>Continue with Google</span>
            </button>
          </>
        )}

        <div className="mt-5 text-center text-[11px] text-zinc-500">
          Secured with InsForge Authentication & Postgres RLS.
        </div>
      </div>
    </div>
  );
}