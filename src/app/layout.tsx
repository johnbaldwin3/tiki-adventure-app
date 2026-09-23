import type { Metadata, Viewport } from "next";
import { AccountBar } from "@/components/account-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Adventures in Tiki", template: "%s · Adventures in Tiki" },
  description:
    "A tasting log and spirits guide for Difford's Guide's Top 100 Tiki & Tropical Cocktails.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <AccountBar />
        {children}
      </body>
    </html>
  );
}
