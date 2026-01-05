import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BlankLogo - Remove Watermarks from AI Videos",
  description:
    "Instantly remove watermarks from Sora, TikTok, Runway, Pika, and other AI-generated videos. Fast, clean, professional results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Facebook Domain Verification */}
        <meta name="facebook-domain-verification" content="nk3uy34a0jkikq80nohcxwistxne25" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
