import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/ui/Header';

const inter = Inter({ subsets: ['latin'] });

// This function properly handles server-side rendering for metadataBase
const getMetadataBase = () => {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'https://quizplus.io';
  // We need to use try/catch because new URL() might throw if the URL is invalid
  try {
    return new URL(url);
  } catch (e) {
    // Fallback to a valid URL
    return new URL('https://quizplus.io');
  }
};

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: 'QuizPlus.io',
  description: 'A multiplayer quiz game powered by AI',
  openGraph: {
    title: 'QuizPlus.io',
    description: 'Create and host AI-powered multiplayer quiz games',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'QuizPlus.io - AI-powered quiz games'
      }
    ],
    type: 'website',
    locale: 'en_US',
    siteName: 'QuizPlus.io'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuizPlus.io',
    description: 'Create and host AI-powered multiplayer quiz games',
    images: ['/og-image.png']
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>
        <Header />
        {children}
      </body>
    </html>
  );
}
