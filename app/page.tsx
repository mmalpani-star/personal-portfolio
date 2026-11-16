import { Awards } from '@/components/home/Awards';
import { Contact } from '@/components/home/Contact';
import { Experience } from '@/components/home/Experience';
import { Hero } from '@/components/home/Hero';
import { Projects } from '@/components/home/Projects';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Experience />
      <Projects />
      <Awards />
      <Contact />
    </main>
  );
}
