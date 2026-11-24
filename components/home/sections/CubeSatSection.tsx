'use client';

import { projects } from '@/data/site-data';
import { CubesatShowcase } from '@/components/projects/CubesatShowcase';

const project = projects.find((p) => p.slug === 'cubesat-antenna-mechanism');

export function CubeSatSection() {
  if (!project) return null;

  return <CubesatShowcase project={project} index={1} total={1} />;
}
