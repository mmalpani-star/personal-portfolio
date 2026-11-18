import type { Metadata } from 'next';
import { SkillsExperience } from '@/components/skills/SkillsExperience';

export const metadata: Metadata = {
  title: 'Skills',
  description: 'Languages, hardware and tools Madhav Malpani works with: unzip the backpack to see them.',
};

export default function SkillsPage() {
  return (
    <main>
      <SkillsExperience />
    </main>
  );
}
