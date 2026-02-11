"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { QueryProvider } from "./QueryProvider";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body
        className={`${inter.variable} min-h-screen bg-slate-50 text-slate-900 antialiased`}
      >
        <QueryProvider>
          <div className="font-sans">{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}
