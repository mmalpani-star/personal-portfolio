import { Awards } from '@/components/home/Awards';
import { Contact } from '@/components/home/Contact';
import { CubeSatSection } from '@/components/home/sections/CubeSatSection';
import { Experience } from '@/components/home/Experience';
import { Hero } from '@/components/home/Hero';
import { LenisScroll } from '@/components/animation/LenisScroll';
import { Projects } from '@/components/home/Projects';

export default function HomePage() {
  return (
    <main>
      <LenisScroll />
      <Hero />
      <CubeSatSection />
      <Experience />
      <Projects />
      <Awards />
      <Contact />
    </main>
  );
}
