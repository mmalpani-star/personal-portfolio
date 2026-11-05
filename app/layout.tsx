import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { PointerFX } from '@/components/effects';
import { Footer, Navbar } from '@/components/layout';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const interTight = Inter_Tight({ subsets: ['latin'], display: 'swap', variable: '--font-inter-tight' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: {
    default: 'Madhav Malpani — Building robots that extend human capability',
    template: '%s — Madhav Malpani',
  },
  description:
    'Undergraduate Artificial Intelligence student at UC San Diego building robots, embedded systems and physical prototypes.',
};

export const viewport: Viewport = {
  themeColor: '#070707',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}>
      <body id="top">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <PointerFX />
        <Navbar />
        <div id="main">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
