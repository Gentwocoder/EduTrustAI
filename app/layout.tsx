import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NetworkProvider } from "@/components/network-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduTrust AI — Verify Academic Credentials Instantly",
  description: "AI-powered academic credential issuance, fraud detection and instant verification secured by BOT Chain.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NetworkProvider>{children}</NetworkProvider>
      </body>
    </html>
  );
}
