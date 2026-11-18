import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { PointerFX } from '@/components/effects/PointerFX';
import { BackToHanger } from '@/components/hub/BackToHanger';
import { HangerHub } from '@/components/hub/HangerHub';
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

/**
 * Runs while the HTML is parsed, before first paint: the landing hanger shows on `/` with no hash.
 * Every other URL (a section anchor, /about, a project page) opens straight into its content, and a home-page
 * section anchor shows only that section (`data-section`), so each section is read on its own.
 * HangerHub takes over from here once React is running.
 */
const hubBootScript = `(function(){try{var d=document.documentElement,h=location.hash,p=location.pathname==='/';d.dataset.hub=p&&(!h||h==='#')?'open':'closed';var m={'#projects':'projects','#awards':'projects','#experience':'experience','#contact':'contact'}[h];if(p&&m)d.dataset.section=m}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body id="top">
        <script dangerouslySetInnerHTML={{ __html: hubBootScript }} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <PointerFX />
        <Navbar />
        <div id="main">{children}</div>
        <Footer />
        <HangerHub />
        <BackToHanger />
      </body>
    </html>
  );
}
