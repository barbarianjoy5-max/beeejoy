"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { User, LogOut, Key, ShoppingBag, ShieldAlert, ChevronDown } from "lucide-react";

export default function Navbar() {
  const { user, profile, isAdmin, isLoading, signOut, openAuthModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-lg font-black text-zinc-950 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/30 transition-all">
            B
          </span>
          <div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
              BEEEJOY
            </span>
            <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-400 uppercase">
              Software Store
            </span>
          </div>
        </Link>

        {/* Navigation items */}
        <nav className="flex items-center gap-6 text-sm font-medium text-zinc-400">
          <Link href="/#extensions" className="hover:text-amber-400 transition-colors">
            Illustrator Extensions
          </Link>
          <Link href="/#partner-software" className="hover:text-amber-400 transition-colors">
            Partner Software
          </Link>
          <Link href="/#licensing" className="hover:text-amber-400 transition-colors">
            Licensing
          </Link>

          <div className="h-4 w-px bg-zinc-800" />

          {isLoading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-zinc-900 border border-zinc-800" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:border-amber-500/50 hover:text-white transition-all"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate">{profile?.full_name || user.email}</span>
                {isAdmin && (
                  <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-400 uppercase">
                    Admin
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              </button>

              {/* User Dropdown */}
              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-xl shadow-black/60 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                      <p className="text-[11px] font-medium text-zinc-400">Signed in as</p>
                      <p className="text-xs font-semibold text-white truncate">{user.email}</p>
                    </div>

                    <Link
                      href="/account"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      <User className="h-3.5 w-3.5 text-amber-400" />
                      <span>My Account</span>
                    </Link>

                    <Link
                      href="/account/licenses"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      <Key className="h-3.5 w-3.5 text-amber-400" />
                      <span>My Licenses & Keys</span>
                    </Link>

                    <Link
                      href="/account/orders"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      <ShoppingBag className="h-3.5 w-3.5 text-amber-400" />
                      <span>Order History</span>
                    </Link>

                    {isAdmin && (
                      <>
                        <div className="my-1 border-t border-zinc-800" />
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Admin Control Panel</span>
                        </Link>
                      </>
                    )}

                    <div className="my-1 border-t border-zinc-800" />

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal("signin")}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500/50 hover:text-white transition-all"
            >
              Sign In
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
