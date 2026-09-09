import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "@fontsource-variable/noto-sans-kr";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "알고리즘 워밍업",
  description: "아이디어를 쓰고, 추천하고, 직접 따라 해보는 알고리즘 워밍업",
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
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
