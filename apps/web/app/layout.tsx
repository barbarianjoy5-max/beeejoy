import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import Navbar from "../components/Navbar";
import AuthModal from "../components/AuthModal";
import AnalyticsTracker from "../components/AnalyticsTracker";
import { getAdminClient } from "../lib/insforge-server";
import {
  SITE_BRANDING_KEY,
  generateThemeCss,
  getGoogleFontFamilies,
  buildGoogleFontsUrl,
  normalizeSiteBranding,
} from "../lib/branding";
import { SiteBrandingConfig } from "../lib/types";

export const metadata: Metadata = {
  title: "BEEEJOY - Premium Software & Illustrator Extensions",
  description: "Official store and marketplace for BEJOY SYSTEM ACTIVE, BEJOY BROWSER, Adobe Illustrator CEP extensions, and curated creator software.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let themeCss = "";
  let googleFontsUrl: string | null = null;

  try {
    const adminDb = getAdminClient();
    const { data } = await adminDb.database
      .from("site_settings")
      .select("value")
      .eq("key", SITE_BRANDING_KEY)
      .maybeSingle();

    if (data?.value) {
      const branding = normalizeSiteBranding(data.value as SiteBrandingConfig);
      themeCss = generateThemeCss(branding.colors, branding.fonts);
      const families = getGoogleFontFamilies(branding.fonts);
      googleFontsUrl = buildGoogleFontsUrl(families);
    }
  } catch (err) {
    console.warn("RootLayout branding load warning:", err);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("beeejoy-theme");if(t==="light"){document.documentElement.classList.add("light");}else{document.documentElement.classList.remove("light");}}catch(e){}})();`,
          }}
        />
        {googleFontsUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={googleFontsUrl} />
          </>
        )}
        {themeCss && (
          <style id="beeejoy-theme-vars" dangerouslySetInnerHTML={{ __html: themeCss }} />
        )}
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-amber-500 selection:text-zinc-950">
        <AuthProvider>
          <Navbar />
          <AuthModal />
          <AnalyticsTracker />
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
