import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { Header } from "@/components/docs/chrome";
import { DeckController, DeckFooter } from "@/components/docs/slides";
import { startSlideCss, startSlideScript } from "@/lib/slides-data";
import "./globals.css";

const sans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL at build time; locally it's localhost.
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Record API tests from real traffic: Keploy + Go quickstart",
  description:
    "A hands-on tutorial: record tests and database mocks from a Go app's real traffic with Keploy, then replay them with the database switched off. Uses Keploy's Gin + MongoDB sample.",
  openGraph: {
    title: "Record API tests from real traffic with Keploy",
    description:
      "Run a Go app, send it two requests, and get tests plus database mocks you can replay with the database off.",
    type: "article",
    url: "/",
  },
  alternates: { canonical: "/" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  // Dark is the default theme, so one dark color whatever the OS prefers.
  themeColor: "#0c0f14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: startSlideScript }} />
        <style dangerouslySetInnerHTML={{ __html: startSlideCss }} />
        <noscript>
          <style>{"body{height:auto!important;overflow:visible!important;display:block!important}main{overflow:visible!important}[data-slide]{display:block!important;margin-bottom:6rem}[data-deck-ui],[data-controls]{display:none!important}"}</style>
        </noscript>
      </head>
      <body className="flex h-dvh flex-col overflow-hidden antialiased">
        <Providers>
          <a
            href="#content"
            className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>
          <Header />
          <main
            id="content"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain tall:overflow-hidden"
          >
            <div className="mx-auto h-full max-w-[84rem] px-4 sm:px-8">{children}</div>
          </main>
          <DeckController />
          <DeckFooter />
        </Providers>
      </body>
    </html>
  );
}
