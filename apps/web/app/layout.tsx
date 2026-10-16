import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import Navbar from "../components/Navbar";
import AuthModal from "../components/AuthModal";

export const metadata: Metadata = {
  title: "BEEEJOY - Premium Software & Illustrator Extensions",
  description: "Official store and marketplace for BEJOY SYSTEM ACTIVE, BEJOY BROWSER, Adobe Illustrator CEP extensions, and curated creator software.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-amber-500 selection:text-zinc-950">
        <AuthProvider>
          <Navbar />
          <AuthModal />
          <main>{children}</main>
          <footer className="border-t border-zinc-900 bg-zinc-950/50 py-12 text-center text-xs text-zinc-600">
            <div className="mx-auto max-w-7xl px-6">
              <p>© {new Date().getFullYear()} BEEEJOY (beeejoy.com). All rights reserved.</p>
              <p className="mt-1 text-zinc-500">
                Premium CEP Extensions & Software Marketplace • Powered by InsForge
              </p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
