// C:\websmith\app\layout.tsx
// Root Layout - Server Component for metadata
// Features: Metadata configuration, imports client layout for conditional sidebar

import type { Metadata } from "next";
import ClientLayout from "./ClientLayout";
import "./globals.css";
import { getSiteUrl } from "../core/config/site";

const siteUrl = getSiteUrl();
const brandImage = "/images/websmith.png";

export const metadata: Metadata = {
  title: "Websmith - Your On-Demand Tech Partner",
  description: "Websmith - Freelancer/SaaS Web Development Agency Management Platform. Connect with top-tier developers.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [{ url: brandImage, type: "image/png" }],
    shortcut: [brandImage],
    apple: [{ url: brandImage, type: "image/png" }],
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
