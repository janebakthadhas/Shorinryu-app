import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Okinawa Shorin-Ryu Karate Do Bukenkan of USA",
  description: "Live class scheduling and booking dashboard for Okinawa Shorin-Ryu Karate Do Bukenkan of USA.",
  icons: {
    icon: "https://www.shorinryubukenkan.com/storage/images/logo.png",
    shortcut: "https://www.shorinryubukenkan.com/storage/images/logo.png",
    apple: "https://www.shorinryubukenkan.com/storage/images/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
