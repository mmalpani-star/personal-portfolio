import { Reveal } from '@/components/animation';
import { awards } from '@/data/site-data';
import type { Award } from '@/data/site-data';
import styles from './Awards.module.css';

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

export function Awards() {
  return (
    <section id="awards" className={`section ${styles.section}`} aria-labelledby="awards-title">
      <div className="page-shell">
        <Reveal className={styles.heading}>
          <span className="section-index">03</span>
          <h2 id="awards-title">Awards</h2>
          <p>Hackathons, computer science and national mathematics.</p>
        </Reveal>

        <ol className={styles.list}>
          {awards.map((award, index) => {
            const { figure, context } = awardFigure(award);
            return (
              <Reveal as="li" key={award.name} className={styles.row} delay={index * 0.05}>
                <span className={styles.year}>{award.year ?? '—'}</span>
                <span className={styles.name}>{award.name}</span>
                <span className={styles.figure}>
                  <strong>{figure}</strong>
                  {context ? <span>{context}</span> : null}
                </span>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
