import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ICON_HREFS } from "@/lib/backdrop";
import { TYPE_CSS } from "@/lib/typeCss";
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
  title: "Focus Orb",
  description: "A dithered particle sphere that visualizes focus time and upcoming meetings",
  icons: {
    icon: [
      { url: ICON_HREFS.svg, type: "image/svg+xml" },
      { url: ICON_HREFS.png32, sizes: "32x32", type: "image/png" },
      { url: ICON_HREFS.ico, sizes: "any" },
    ],
    apple: [{ url: ICON_HREFS.apple, sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <style dangerouslySetInnerHTML={{ __html: TYPE_CSS }} />
        {children}
      </body>
    </html>
  );
}
