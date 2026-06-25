import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import RecoveryHandler from "@/components/RecoveryHandler";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LinkedIn PostPilot",
  description:
    "AI-powered personal LinkedIn operating system — generate posts, hooks, hashtags, and visuals in seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans text-ink antialiased">
        <RecoveryHandler />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
