// C:\websmith\app\layout.tsx
// Root Layout - Server Component for metadata
// Features: Metadata configuration, imports client layout for conditional sidebar

import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import ClientLayout from "./ClientLayout";
import "./globals.css";
import { getSiteUrl } from "../core/config/site";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const siteUrl = getSiteUrl();
const brandImage = "/images/websmith_original.jpg";

export const metadata: Metadata = {
  title: "WebSmith Digital — Enterprise Digital Ecosystems & Custom Software Engineering",
  description: "WebSmith Digital builds high-performance web applications, enterprise ERP systems, and universal software licensing platforms for high-growth businesses.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      { url: "/images/icon.png", type: "image/png" },
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon.ico" },
    ],
    shortcut: ["/images/icon.png"],
    apple: [{ url: "/images/icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "WebSmith Digital — Enterprise Digital Ecosystems & Custom Software Engineering",
    description: "WebSmith Digital builds high-performance web applications, enterprise ERP systems, and universal software licensing platforms for high-growth businesses.",
    url: siteUrl,
    siteName: "WebSmith Digital",
    images: [
      {
        url: brandImage,
        alt: "WebSmith Digital",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WebSmith Digital — Enterprise Digital Ecosystems & Custom Software Engineering",
    description: "WebSmith Digital builds high-performance web applications, enterprise ERP systems, and universal software licensing platforms for high-growth businesses.",
    images: [brandImage],
  },
  other: {
    "breachme-verify": "breachme-verify=31c45e09d95fec00f33d4c4bef16d2d9",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${plusJakartaSans.variable} ${inter.variable}`}>
      <body className="antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
