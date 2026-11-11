import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeBackground } from "@/components/theme/Backgrounds";
import { auth } from "@/auth";
import { getStore } from "@/lib/db";
import { THEMES } from "@/lib/themes/contract";
import { DEFAULT_THEME, type ThemeId } from "@/lib/themes/ids";

// Every page renders per request so the CSP nonce can be applied.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mawa AI",
  description: "Your sarcastic, chilling, flexing personal AI.",
  manifest: "/manifest.webmanifest",
  applicationName: "Mawa AI",
  appleWebApp: { capable: true, title: "Mawa AI", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

async function currentTheme(): Promise<ThemeId> {
  try {
    const s = await auth();
    return s?.user?.id ? getStore().getSettings(s.user.id).theme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await currentTheme();
  return (
    <html lang="en" data-theme={theme} style={{ colorScheme: THEMES[theme].light ? "light" : "dark" }}>
      <head><meta name="theme-color" content={THEMES[theme].metaColor} /></head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider initial={theme}>
          <ThemeBackground />
          <div className="relative z-10">{children}</div>
        </ThemeProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
