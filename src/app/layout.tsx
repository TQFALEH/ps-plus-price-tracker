import type { Metadata } from "next";
import { Cairo, Sora } from "next/font/google";
import { Providers } from "@/components/providers";
import "@/styles/globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap"
});

const cairo = Cairo({
  subsets: ["latin", "arabic"],
  variable: "--font-cairo",
  display: "swap"
});

export const metadata: Metadata = {
  title: "PlayStation Plus Price Tracker",
  description: "Track PlayStation Plus prices by region"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${cairo.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
