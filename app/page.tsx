import { Capabilities } from '@/components/home/Capabilities';
import { Contact } from '@/components/home/Contact';
import { Experience } from '@/components/home/Experience';
import { Hero } from '@/components/home/Hero';
import { Work } from '@/components/home/Work';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Work />
      <Experience />
      <Capabilities />
      <Contact />
    </main>
  );
}
