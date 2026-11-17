'use client';

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { getImageProps } from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Magnetic } from '@/components/effects/Magnetic';
import { useFinePointer } from '@/components/effects/useFinePointer';
import { Icon } from '@/components/ui/Icon';
import { displayProjects, education } from '@/data/site-data';
import styles from './Hero.module.css';

const imageAlt = 'Custom hexapod robot with blue and white 3D-printed legs on a workbench';

// Art direction: landscape hexapod on wide screens, portrait quadruped on phones.
// Both requests share sizes and quality with the first project card, so phones
// download the quadruped photo once.
const common = { alt: imageAlt, sizes: '(max-width: 767px) 88vw, 100vw', quality: 62, priority: true } as const;
const {
  props: { srcSet: desktopSrcSet },
} = getImageProps({ ...common, src: '/images/projects/hexapod/Hexapod Assembly.jpg', width: 4032, height: 3024 });
const {
  props: { srcSet: mobileSrcSet, ...imgProps },
} = getImageProps({ ...common, src: '/images/projects/quadruped/quadruped_full_build.jpeg', width: 1200, height: 1600 });

function SanDiegoClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const format = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const tick = () => setTime(format.format(new Date()));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, []);

  return <>{time ?? '--:--'} PT</>;
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const finePointer = useFinePointer();

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const pointerX = useSpring(0, { stiffness: 60, damping: 20 });
  const pointerY = useSpring(0, { stiffness: 60, damping: 20 });

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!finePointer) return;
    const r = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - r.left) / r.width - 0.5) * -14);
    pointerY.set(((event.clientY - r.top) / r.height - 0.5) * -10);
  };

  // Read the preference after mount: the server cannot know it, and using it
  // during the first render makes the hydrated style differ from the HTML.
  const [still, setStill] = useState(false);
  useEffect(() => setStill(Boolean(reduceMotion)), [reduceMotion]);
  const university = education[0];

  const facts = [
    { label: 'Hand-built robots', value: 'Four and six legged' },
    { label: university.institution.replace('University of California San Diego', 'UC San Diego'), value: university.degree },
    { label: 'Capstone', value: 'CAN FD transceiver board, built' },
    { label: `${displayProjects.length} projects`, value: 'Built and documented' },
    { label: 'San Diego', value: <SanDiegoClock /> },
  ];

  return (
    <section ref={ref} className={styles.hero} onPointerMove={onPointerMove} aria-labelledby="hero-title">
      {/* ---------- Graded photograph ---------- */}
      <motion.div className={styles.stage} style={still ? undefined : { scale: stageScale }}>
        <motion.div className={styles.depth} style={still ? undefined : { x: pointerX, y: pointerY }}>
          <picture>
            <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
            {/* eslint-disable-next-line @next/next/no-img-element -- art-directed <picture> via getImageProps */}
            <img {...imgProps} srcSet={mobileSrcSet} className={styles.image} alt={imageAlt} />
          </picture>
        </motion.div>
        <div className={styles.grade} aria-hidden="true" />
        <div className={styles.bloom} aria-hidden="true" />
        <div className={styles.striation} aria-hidden="true" />
      </motion.div>

      {/* ---------- Headline ---------- */}
      <motion.div className={styles.copyLayer} style={still ? undefined : { y: copyY, opacity: copyOpacity }}>
        <div className={`page-shell ${styles.copy}`}>
          <div className={`label ${styles.kicker} reveal-eager`}>Madhav Malpani · B.S. AI, UC San Diego</div>
          <h1 id="hero-title" className={`${styles.title} reveal-eager`} style={{ animationDelay: '0.08s' }}>
            Building robots that extend human capability.
          </h1>
          <p className={`${styles.lead} reveal-eager`} style={{ animationDelay: '0.16s' }}>
            Legged machines, custom boards and the software that drives them.
          </p>
          <div className={`cta-row ${styles.actions} reveal-eager`} style={{ animationDelay: '0.24s' }}>
            <Magnetic>
              <Link href="/#projects" className="button button-primary">
                See the work
                <Icon name="arrow-right" size={15} />
              </Link>
            </Magnetic>
            <a href="/documents/resume.pdf" className="button button-secondary" target="_blank" rel="noopener noreferrer">
              Resume
              <Icon name="arrow-up-right" size={14} />
            </a>
          </div>
        </div>
      </motion.div>

      {/* ---------- Fact rail ---------- */}
      <div className={styles.rail}>
        <div className={`page-shell ${styles.railInner}`}>
          {facts.map((fact, index) => (
            <div key={fact.label} className={styles.fact} data-lead={index === 0}>
              <span className={styles.factLabel}>{fact.label}</span>
              <span className={styles.factValue}>{fact.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
