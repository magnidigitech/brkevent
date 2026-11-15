import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Bhashyam Ramakrishna Event Entry System',
  description: 'Official invitation verification and entry management for Bhashyam Ramakrishna’s event.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BRK Event',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f59e0b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-[#f5f5f7] flex flex-col text-[#1d1d1f] antialiased selection:bg-neutral-200" suppressHydrationWarning>
        <Header />
        <main className="flex-1 flex flex-col pb-24 sm:pb-8">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
