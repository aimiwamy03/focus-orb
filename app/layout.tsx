import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: "Focus Orb",
    template: "%s",
  },
  description: "A dithered particle sphere that visualizes focus time and upcoming meetings",
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
