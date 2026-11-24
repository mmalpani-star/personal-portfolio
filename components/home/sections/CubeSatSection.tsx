'use client';

import { projects } from '@/data/site-data';
import { ModelSection } from './ModelSection';

const project = projects.find((p) => p.slug === 'cubesat-antenna-mechanism');

export function CubeSatSection() {
  if (!project) return null;

  return (
    <ModelSection
      id="cubesat"
      eyebrow="01 — CubeSat"
      title={project.title}
      description={project.summary}
      model="/models/cubesat.glb"
      accent="#ffd400"
      stars
      shootingStar
    />
  );
}
