import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://kynpleads.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kyn'P Leads",
    template: "%s · Kyn'P Leads",
  },
  description:
    "Kyn'P Leads is a multi-tenant lead-generation and automated outreach platform. Sign up free, link your Gmail accounts (up to 5) and API keys (Serper.dev, OpenAI, SMTP), specify your target country, brand and service — Kyn'P finds leads, composes tailored messages, and dispatches them on a 30-second cadence with 24-hour follow-ups.",
  applicationName: "Kyn'P Leads",
  keywords: [
    "Kyn'P Leads",
    "lead generation",
    "cold outreach automation",
    "Gmail outreach",
    "sales automation",
    "Serper.dev",
    "AI outreach",
    "follow-up automation",
    "B2B prospecting",
    "multi-tenant outreach platform",
  ],
  authors: [{ name: "Kyn'P Leads", url: siteUrl }],
  creator: "Kyn'P Leads",
  publisher: "Kyn'P Leads",
  category: "Sales Automation",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [{ url: "/logo.png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Kyn'P Leads",
    title: "Kyn'P Leads",
    description:
      "Multi-tenant lead-generation & automated Gmail outreach. Sign up free, plug in your Serper.dev key + 5 Gmail accounts, and let Kyn'P run your cadence.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Kyn'P Leads logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kyn'P Leads",
    description:
      "Multi-tenant lead-generation & automated Gmail outreach on a 30-second cadence with 24-hour follow-ups.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: { canonical: siteUrl },
};

export const viewport = {
  themeColor: "#F5C518",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="light">
      <head>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Kyn'P Leads",
              url: siteUrl,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description:
                "Multi-tenant lead-generation and automated Gmail outreach platform with 30-second dispatch cadence and 24-hour follow-ups.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              featureList: [
                "Lead discovery via Serper.dev",
                "AI message composition",
                "Multi-Gmail rotation (up to 5)",
                "30-second dispatch cadence",
                "24-hour follow-up automation",
                "Multi-tenant accounts",
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={true}
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
