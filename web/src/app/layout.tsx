import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

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
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
