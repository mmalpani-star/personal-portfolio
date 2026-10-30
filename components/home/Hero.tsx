'use client';

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { getImageProps } from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Magnetic, useFinePointer } from '@/components/effects';
import { Icon } from '@/components/ui/Icon';
import { currentlyBuilding, heroAnnotations, technicalInterests } from '@/data/site-data';
import type { HeroAnnotation } from '@/data/site-data';
import styles from './Hero.module.css';

const imageAlt = 'Custom hexapod robot with blue and white 3D-printed legs on a workbench';

// Art direction: landscape hexapod on wide screens, portrait quadruped on phones.
const common = { alt: imageAlt, sizes: '100vw', quality: 80, priority: true } as const;
const {
  props: { srcSet: desktopSrcSet },
} = getImageProps({ ...common, src: '/images/projects/hexapod/Hexapod Assembly.jpg', width: 4032, height: 3024 });
const {
  props: { srcSet: mobileSrcSet, ...imgProps },
} = getImageProps({ ...common, src: '/images/projects/quadruped/quadruped_full_build.jpeg', width: 1200, height: 1600 });

function Callout({ annotation, index }: { annotation: HeroAnnotation; index: number }) {
  return (
    <div
      className={styles.callout}
      data-side={annotation.side}
      style={
        {
          left: `${annotation.x * 100}%`,
          top: `${annotation.y * 100}%`,
          '--delay': `${1.1 + index * 0.25}s`,
        } as CSSProperties
      }
    >
      <span className={styles.dot} />
      <span className={styles.leader} />
      <span className={styles.tag}>
        <span className={styles.tagLabel}>{annotation.label}</span>
        <span className={styles.tagValue}>{annotation.value}</span>
      </span>
    </div>
  );
}

function SanDiegoClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const format = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const tick = () => setTime(format.format(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return <span className={styles.clock}>{time ?? '--:--:--'} PT</span>;
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const finePointer = useFinePointer();

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const stageY = useTransform(scrollYProgress, [0, 1], ['0%', '10%']);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  const pointerX = useSpring(0, { stiffness: 60, damping: 20 });
  const pointerY = useSpring(0, { stiffness: 60, damping: 20 });

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!finePointer) return;
    const r = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - r.left) / r.width - 0.5) * -18);
    pointerY.set(((event.clientY - r.top) / r.height - 0.5) * -12);
  };

  const still = Boolean(reduceMotion);

  return (
    <section ref={ref} className={styles.hero} onPointerMove={onPointerMove} aria-labelledby="hero-title">
      <motion.div
        className={styles.stage}
        style={still ? undefined : { scale: stageScale, y: stageY }}
      >
        <motion.div className={styles.depth} style={still ? undefined : { x: pointerX, y: pointerY }}>
          <div className={styles.plate}>
            <picture>
              <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
              {/* eslint-disable-next-line @next/next/no-img-element -- art-directed <picture> via getImageProps */}
              <img {...imgProps} srcSet={mobileSrcSet} className={styles.image} alt={imageAlt} />
            </picture>
            <div className={styles.grade} aria-hidden="true" />
            <div className={styles.gridOverlay} aria-hidden="true" />

            <div className={styles.annotationsDesktop} aria-hidden="true">
              <div className={styles.span} style={{ '--delay': '0.9s' } as CSSProperties}>
                <span className={styles.spanLabel}>{heroAnnotations.desktopSpan}</span>
              </div>
              {heroAnnotations.desktop.map((annotation, index) => (
                <Callout key={annotation.value} annotation={annotation} index={index} />
              ))}
            </div>
            <div className={styles.annotationsMobile} aria-hidden="true">
              {heroAnnotations.mobile.map((annotation, index) => (
                <Callout key={annotation.value} annotation={annotation} index={index} />
              ))}
            </div>

            <span className={styles.figure} aria-hidden="true">
              <span>FIG. 01</span>
              <span className={styles.figureDesktop}>Custom hexapod — assembled</span>
              <span className={styles.figureMobile}>Quadruped — assembled</span>
            </span>
          </div>
        </motion.div>
      </motion.div>

      <motion.div className={styles.copyLayer} style={still ? undefined : { y: copyY, opacity: copyOpacity }}>
        <div className={`page-shell ${styles.copy}`}>
          <div className={`label ${styles.kicker} reveal-eager`}>
            Madhav Malpani · AI × Robotics × Hardware
          </div>
          <h1 id="hero-title" className={`${styles.title} reveal-eager`} style={{ animationDelay: '0.08s' }}>
            Building robots that extend human capability.
          </h1>
          <p className={`${styles.tagline} reveal-eager`} style={{ animationDelay: '0.18s' }}>
            One iteration at a time.
          </p>
          <p className={`${styles.intro} reveal-eager`} style={{ animationDelay: '0.26s' }}>
            I’m an undergraduate Artificial Intelligence student at UC San Diego. I build physical systems — legged
            robots, embedded hardware and prototypes — and learn by taking them apart and improving them.
          </p>
          <div className={`cta-row ${styles.actions} reveal-eager`} style={{ animationDelay: '0.34s' }}>
            <Magnetic>
              <Link href="/#work" className="button button-primary">
                Explore the work
                <Icon name="arrow-down" size={15} />
              </Link>
            </Magnetic>
            <Link href="/about" className="button button-secondary">
              About me
            </Link>
          </div>
        </div>
      </motion.div>

      <div className={styles.readout}>
        <div className={`page-shell ${styles.readoutInner}`}>
          <div className={styles.cell}>
            <span className="label">Now</span>
            <span className={styles.cellValue}>
              <span className={styles.live} aria-hidden="true" />
              {currentlyBuilding.organization} — CAN FD transceiver board
            </span>
          </div>
          <div className={`${styles.cell} ${styles.cellWide}`}>
            <span className="label">Focus</span>
            <span className={styles.cellValue}>
              {technicalInterests[0]} · VLA models · {technicalInterests[5]}
            </span>
          </div>
          <div className={`${styles.cell} ${styles.cellWide}`}>
            <span className="label">San Diego</span>
            <SanDiegoClock />
          </div>
          <a href="#philosophy" className={`${styles.cell} ${styles.scroll}`}>
            <span className="label">Scroll</span>
            <span className={styles.scrollLine} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
