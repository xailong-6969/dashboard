import "./globals.css";
import { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Delphi Analytics | Gensyn Testnet",
  description: "Track prediction markets, analyze trading patterns, and view P&L for Delphi on Gensyn Testnet.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/bat-logo.png", type: "image/png" },
    ],
    apple: "/bat-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
