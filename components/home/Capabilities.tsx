import Image from 'next/image';
import { Reveal } from '@/components/animation';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { awards, secondaryWork } from '@/data/site-data';
import type { Award } from '@/data/site-data';
import { Skills } from './Skills';
import styles from './Capabilities.module.css';

// Covered in full under Experience; the rest are smaller explorations shown here.
const coveredInExperience = new Set(['Machine Learning', 'Pickle It Down']);

/**
 * Uses the award's explicit figure when given; otherwise splits e.g.
 * "Rank 411 / 8600 globally" into "#411" and "of 8600 globally".
 */
function awardFigure({ name, detail, year, figure: explicitFigure, context: explicitContext }: Award) {
  if (explicitFigure) return { figure: explicitFigure, context: explicitContext ?? '' };
  if (detail === year) return { figure: /finalist/i.test(name) ? 'Finalist' : detail, context: '' };
  const match = detail.match(/(\d[\d,]*)(?:\s*\/\s*(\d[\d,]*))?/);
  if (!match) return { figure: detail, context: '' };
  const rest = detail.replace(match[0], '').replace(/\s+/g, ' ').trim();
  const figure = /rank/i.test(detail) ? `#${match[1]}` : match[1];
  const context = match[2] ? `of ${match[2]} ${rest.replace(/rank/i, '').trim()}`.trim() : rest;
  return { figure, context };
}

export function Capabilities() {
  const explored = secondaryWork.filter((item) => !coveredInExperience.has(item.title));

  return (
    <section id="capabilities" className="section" aria-labelledby="capabilities-title">
      <div className="page-shell">
        <Reveal>
          <SectionHeading
            eyebrow="04 — Toolkit & recognition"
            title={<span id="capabilities-title">Tools I use. Results so far.</span>}
            description="The languages, hardware skills and software I actually work with, plus competition results."
          />
        </Reveal>

        <Reveal>
          <Skills />
        </Reveal>

        <div className={styles.lower}>
          <div>
            <div className={styles.blockHead}>
              <span className="label">Awards</span>
              <span className={styles.blockCount}>{String(awards.length).padStart(2, '0')}</span>
            </div>
            <ol className={styles.awards}>
              {awards.map((award, index) => {
                const { figure, context } = awardFigure(award);
                return (
                  <Reveal as="li" key={award.name} className={`${styles.award} spotlight`} delay={index * 0.06}>
                    <span className={styles.awardYear}>{award.year}</span>
                    <span className={styles.awardName}>{award.name}</span>
                    <span className={styles.awardFigure}>
                      <strong>{figure}</strong>
                      {context ? <span>{context}</span> : null}
                    </span>
                  </Reveal>
                );
              })}
            </ol>
          </div>

          {explored.length ? (
            <div>
              <div className={styles.blockHead}>
                <span className="label">Also explored</span>
                <span className={styles.blockCount}>{String(explored.length).padStart(2, '0')}</span>
              </div>
              <ul className={styles.explored}>
                {explored.map((item) => (
                  <li key={item.title} className={`${styles.exploredItem} ${item.image ? styles.exploredWithImage : ''}`}>
                    {item.image ? (
                      <span className={styles.exploredImage}>
                        <Image src={item.image.src} alt={item.image.alt} fill sizes="120px" style={{ objectFit: 'contain' }} />
                      </span>
                    ) : null}
                    <span className={styles.exploredTitle}>{item.title}</span>
                    <span className={styles.exploredDetail}>{item.details.join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
