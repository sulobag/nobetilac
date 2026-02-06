"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { QueryProvider } from "./QueryProvider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
