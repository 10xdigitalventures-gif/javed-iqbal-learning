import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { BrandingProvider } from "@/lib/branding";
import { LeadConnector } from "@/components/lead-connector";

export const metadata: Metadata = {
  title: "Prof. Dr. Javed Iqbal — Learning Platform",
  description:
    "Books, audio books, courses, community and private messaging — the official learning platform of Prof. Dr. Javed Iqbal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <BrandingProvider>
          <AuthProvider>{children}</AuthProvider>
          <LeadConnector />
        </BrandingProvider>
      </body>
    </html>
  );
}
