import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';

import { Navbar } from '@/components/navbar';
import { ThemeProvider } from '@/components/theme-provider';
import { AppBackground } from '@/components/app-background';
import { Footer } from '@/components/footer';
import { NetworkUrlSync } from '@/components/network-url-sync';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'IOTA Explorer',
  description: 'Community-driven tool for validators on the IOTA network',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <NetworkUrlSync />
          </Suspense>
          <AppBackground />
          <Navbar />
          <div className="relative z-10 flex flex-1 flex-col">
            {children}
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
