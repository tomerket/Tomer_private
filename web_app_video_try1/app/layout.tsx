import type { Metadata } from "next";
import { Inter_Tight, Space_Grotesk, Space_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

// Display voice (held in reserve), dense interface, and timecode readout.
const grotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });
const mono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: {
    default: "Screening Room",
    template: "%s | Screening Room",
  },
  description: "A private place to watch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${grotesk.variable} ${interTight.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col lg:flex-row">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
