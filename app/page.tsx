import { EnergyOrb } from '@/components/effects/EnergyOrb';
import { ShotArc } from '@/components/effects/ShotArc';
import { Contact } from '@/components/home/Contact';
import { Experience } from '@/components/home/Experience';
import { Hero } from '@/components/home/Hero';
import { OffTheClock } from '@/components/home/OffTheClock';
import { SideQuests } from '@/components/home/SideQuests';
import { StatsTrophies } from '@/components/home/StatsTrophies';
import { Work } from '@/components/home/Work';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <EnergyOrb />
      <Work />
      <SideQuests />
      <ShotArc />
      <Experience />
      <StatsTrophies />
      <OffTheClock />
      <Contact />
    </main>
  );
}
