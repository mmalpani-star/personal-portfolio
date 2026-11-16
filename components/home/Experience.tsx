'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Reveal } from '@/components/animation';
import { ArcHeading } from '@/components/ui/ArcHeading';
import { Icon } from '@/components/ui/Icon';
import { education, experience } from '@/data/site-data';
import type { Experience as ExperienceItem } from '@/data/site-data';
import { IterationStrip } from './IterationStrip';
import styles from './Experience.module.css';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Sort key from the start of a "Mon YYYY – …" range. */
function startKey(item: ExperienceItem) {
  const [month, year] = (item.dates ?? '').split(' ');
  return Number(year) * 12 + Math.max(0, months.indexOf(month));
}

type RowProps = {
  tag: string;
  dates?: string;
  title: string;
  organization: string;
  summary?: string;
  current?: boolean;
  delay?: number;
  /** Expanded content. Rows without any are not expandable. */
  children?: ReactNode;
};

/** One timeline row: a one-line summary, with the full detail behind "Expand". */
function Row({ tag, dates, title, organization, summary, current = false, delay = 0, children }: RowProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const cells = (
    <>
      <span className={styles.meta}>
        <span className={styles.tag}>
          {current ? <span className={styles.live} aria-hidden="true" /> : null}
          {tag}
        </span>
        <span className={styles.dates}>{dates}</span>
      </span>
      <span className={styles.who}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowOrg}>{organization}</span>
      </span>
      <span className={styles.summary}>{summary}</span>
    </>
  );

  return (
    <Reveal as="li" className={`${styles.row} ${current ? styles.rowCurrent : ''}`} delay={delay}>
      <h3 className={styles.rowHeading}>
        {children ? (
          <button
            type="button"
            className={styles.rowButton}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {cells}
            <span className={styles.expand}>
              <span className={styles.expandLabel}>{open ? 'Collapse' : 'Expand'}</span>
              <span className={styles.expandIcon} data-open={open} aria-hidden="true">
                <Icon name="plus" size={14} />
              </span>
            </span>
          </button>
        ) : (
          <span className={styles.rowButton}>{cells}</span>
        )}
      </h3>

      <AnimatePresence initial={false}>
        {open && children ? (
          <motion.div
            id={panelId}
            className={styles.panelWrap}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.panel}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Reveal>
  );
}

function ExperienceDetail({ item }: { item: ExperienceItem }) {
  return (
    <>
      <div className={styles.panelText}>
        {item.details ? (
          <ul className={styles.checklist}>
            {item.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
        {item.socialLink ? (
          <a href={item.socialLink.href} className={styles.social} target="_blank" rel="noreferrer">
            {item.socialLink.label}
            <Icon name="arrow-up-right" size={13} />
          </a>
        ) : null}
      </div>

      {item.isCurrent ? (
        <div className={styles.panelMedia}>
          <span className="label">Iteration log</span>
          <IterationStrip images={item.images} videos={item.videos} />
        </div>
      ) : item.images?.length ? (
        <div className={styles.entryMedia}>
          {item.images.map((image) => (
            <figure
              key={image.src}
              className={`${styles.entryFigure} ${image.width > image.height ? styles.entryFigureWide : ''}`}
            >
              <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="176px" />
              {image.caption ? <figcaption>{image.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function Experience() {
  const sorted = [...experience].sort((a, b) => startKey(b) - startKey(a));

  return (
    <section id="experience" className={`section section--raised ${styles.section}`} aria-labelledby="experience-title">
      <div className="page-shell">
        <Reveal>
          <ArcHeading
            arc="03"
            id="experience-title"
            title="The Build Log"
            description="A robotics team, two internships and a community I started. Newest first."
          />
        </Reveal>

        <ol className={styles.timeline}>
          {sorted.map((item, index) => (
            <Row
              key={`${item.organization}-${item.title}`}
              tag={String(sorted.length - index).padStart(2, '0')}
              dates={item.dates}
              title={item.title}
              organization={[item.organization, item.location].filter(Boolean).join(' · ')}
              summary={item.summary}
              current={item.isCurrent}
              delay={index * 0.05}
            >
              <ExperienceDetail item={item} />
            </Row>
          ))}
        </ol>

        <div className={styles.education}>
          <div className={styles.educationHead}>
            <span className="label">Education</span>
          </div>
          <ol className={styles.timeline}>
            {education.map((item, index) => (
              <Row
                key={item.institution}
                tag="EDU"
                dates={item.expectedGraduation ? `Exp. ${item.expectedGraduation}` : item.dates}
                title={item.institution}
                organization={item.degree}
                summary={item.summary}
                delay={index * 0.05}
              >
                {item.details ? (
                  <div className={styles.panelText}>
                    <ul className={styles.checklist}>
                      {item.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Row>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
