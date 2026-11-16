'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useCallback, useState } from 'react';
import { Reveal } from '@/components/animation';
import { ArcHeading } from '@/components/ui/ArcHeading';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { displayProjects, secondaryWork } from '@/data/site-data';
import type { ProjectStatus } from '@/data/site-data';
import { BuildDrawer } from './BuildDrawer';
import styles from './SideQuests.module.css';

export type Quest = {
  id: string;
  title: string;
  name: string;
  category: string;
  teaser: string;
  status?: ProjectStatus;
  statusNote?: string;
  summary?: string;
  points: string[];
  technologies: string[];
  image?: { src: string; alt: string; width: number; height: number };
  /** CAD renders sit on a light plate and are shown whole. */
  render?: boolean;
  slug?: string;
  github?: string;
  achievement?: { label: string; detail: string };
};

const projectQuests: Quest[] = displayProjects
  .filter((project) => project.tier !== 'flagship')
  .map((project) => ({
    id: project.slug,
    title: project.shortTitle,
    name: project.title,
    category: project.category,
    teaser: project.teaser,
    status: project.status,
    statusNote: project.statusNote,
    summary: project.summary,
    points: project.highlights.slice(0, 4),
    technologies: project.technologies,
    image: project.heroMedia?.type === 'image' ? project.heroMedia : undefined,
    slug: project.slug,
    github: project.github,
    achievement: project.achievement,
  }));

// Smaller explorations; the ones with a teaser are not covered under Experience.
const exploredQuests: Quest[] = secondaryWork
  .filter((item) => item.teaser)
  .map((item) => ({
    id: item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: item.title,
    name: item.title,
    category: 'Exploration',
    teaser: item.teaser ?? '',
    points: item.details,
    technologies: [],
    image: item.image,
    render: Boolean(item.image),
  }));

const quests = [...projectQuests, ...exploredQuests];
const initialCount = 4;

/** Rubber stretch: tiles arrive pulled wide and flat, then snap back to shape. */
const snap = { type: 'spring', stiffness: 380, damping: 13, mass: 0.9 } as const;
const stretched = { opacity: 0, scaleX: 1.16, scaleY: 0.72 };
const settled = { opacity: 1, scaleX: 1, scaleY: 1 };

export function SideQuests() {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const close = useCallback(() => setOpenId(null), []);

  const visible = expanded ? quests : quests.slice(0, initialCount);
  const open = quests.find((quest) => quest.id === openId) ?? null;

  return (
    <section id="quests" className="section" aria-labelledby="quests-title">
      <div className="page-shell">
        <Reveal>
          <ArcHeading
            arc="02"
            id="quests-title"
            title="Side Quests"
            description="Internship hardware, sensors, a hackathon and two CAD experiments. Tap one for details."
          />
        </Reveal>

        <ul className={styles.grid}>
          {visible.map((quest, index) => (
            <motion.li
              key={quest.id}
              className={styles.item}
              initial={stretched}
              // The first four snap in once on scroll; the rest snap in when "Show all" is pressed.
              {...(index < initialCount
                ? { whileInView: settled, viewport: { once: true, amount: 0.4 } }
                : { animate: settled })}
              transition={reduceMotion ? { duration: 0 } : { ...snap, delay: (index % initialCount) * 0.07 }}
            >
              <motion.button
                whileTap={reduceMotion ? undefined : { scaleX: 1.03, scaleY: 0.95 }}
                type="button"
                className={`${styles.tile} spotlight`}
                onClick={() => setOpenId(quest.id)}
                aria-haspopup="dialog"
              >
                <span className={`${styles.thumb} ${quest.render ? styles.thumbRender : ''}`}>
                  {quest.image ? (
                    <Image
                      src={quest.image.src}
                      alt=""
                      fill
                      sizes="96px"
                      style={{ objectFit: quest.render ? 'contain' : 'cover' }}
                    />
                  ) : (
                    <span className={styles.thumbEmpty} aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  )}
                </span>
                <span className={styles.text}>
                  <span className={styles.titleRow}>
                    <span className={styles.title}>{quest.title}</span>
                    {quest.status ? <StatusBadge status={quest.status} /> : null}
                  </span>
                  <span className={styles.teaser}>{quest.teaser}</span>
                </span>
                <span className={styles.more} aria-hidden="true">
                  <Icon name="plus" size={16} />
                </span>
              </motion.button>
            </motion.li>
          ))}
        </ul>

        {quests.length > initialCount ? (
          <div className={styles.toggleRow}>
            <motion.button
              type="button"
              className="button button-secondary"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              whileTap={reduceMotion ? undefined : { scaleX: 1.14, scaleY: 0.88 }}
              transition={snap}
            >
              {expanded ? 'Show fewer' : `Show all ${quests.length}`}
              <Icon name="arrow-down" size={14} style={expanded ? { transform: 'rotate(180deg)' } : undefined} />
            </motion.button>
          </div>
        ) : null}
      </div>

      <BuildDrawer quest={open} onClose={close} />
    </section>
  );
}
