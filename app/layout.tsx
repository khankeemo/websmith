// C:\websmith\app\layout.tsx
// Root Layout - Server Component for metadata
// Features: Metadata configuration, imports client layout for conditional sidebar

import type { Metadata } from "next";
import ClientLayout from "./ClientLayout";
import "./globals.css";
import { getSiteUrl } from "../core/config/site";

const siteUrl = getSiteUrl();
const brandImage = "/images/websmith_original.jpg";

export const metadata: Metadata = {
  title: "Websmith - Your On-Demand Tech Partner",
  description: "Websmith - Freelancer/SaaS Web Development Agency Management Platform. Connect with top-tier developers.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon.ico" },
    ],
    shortcut: ["/images/favicon.ico"],
    apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Websmith - Your On-Demand Tech Partner",
    description: "Websmith - Freelancer/SaaS Web Development Agency Management Platform. Connect with top-tier developers.",
    url: siteUrl,
    siteName: "Websmith",
    images: [
      {
        url: brandImage,
        alt: "Websmith",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Websmith - Your On-Demand Tech Partner",
    description: "Websmith - Freelancer/SaaS Web Development Agency Management Platform. Connect with top-tier developers.",
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
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
