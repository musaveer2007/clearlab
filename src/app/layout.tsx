import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import MedicalGlossary from "@/components/MedicalGlossary";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClearLab - Lab Report Interpreter",
  description: "Educational tool to understand medical lab results safely and clearly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 py-4 px-6 sticky top-0 z-50 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-white tracking-tight">ClearLab</Link>
            <nav className="flex space-x-6">
              <Link href="/history" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">History</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 w-full max-w-5xl mx-auto p-6">
          {children}
        </main>
        <footer className="border-t border-white/10 py-6 mt-12">
          <div className="max-w-5xl mx-auto px-6 text-center text-slate-400 text-sm">
            <p>&copy; {new Date().getFullYear()} ClearLab. All rights reserved.</p>
            <p className="mt-2 text-xs opacity-70">Remember to consult your doctor for medical decisions.</p>
          </div>
        </footer>
        <MedicalGlossary />
      </body>
    </html>
  );
}
