import { Reveal } from '@/components/animation';
import { ArcHeading } from '@/components/ui/ArcHeading';
import { awards, verifiedSkills } from '@/data/site-data';
import type { Award } from '@/data/site-data';
import { PlayerCard } from './PlayerCard';
import styles from './StatsTrophies.module.css';

const skillGroups = [
  { title: 'Code', items: verifiedSkills.programming },
  { title: 'Engineering', items: verifiedSkills.engineering },
  { title: 'Tools', items: verifiedSkills.software },
];

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

export function StatsTrophies() {
  return (
    <section id="stats" className="section" aria-labelledby="stats-title">
      <div className="page-shell">
        <Reveal>
          <ArcHeading
            arc="04"
            id="stats-title"
            title="Stats & Trophies"
            description="What I work with, how I rate myself at it, and where it has ranked."
          />
        </Reveal>

        <div className={styles.layout}>
          <Reveal>
            <PlayerCard />
          </Reveal>

          <div className={styles.side}>
            <Reveal>
              <div className={styles.blockHead}>
                <span className="label">Toolkit</span>
              </div>
              <dl className={styles.skills}>
                {skillGroups.map((group) => (
                  <div key={group.title} className={styles.skillRow}>
                    <dt>{group.title}</dt>
                    <dd className="tag-list">
                      {group.items.map((item) => (
                        <span key={item} className="tag">
                          {item}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <div>
              <div className={styles.blockHead}>
                <span className="label">Trophies</span>
                <span className={styles.blockCount}>{String(awards.length).padStart(2, '0')}</span>
              </div>
              <ol className={styles.awards}>
                {awards.map((award, index) => {
                  const { figure, context } = awardFigure(award);
                  return (
                    <Reveal as="li" key={award.name} className={styles.award} delay={index * 0.05}>
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
          </div>
        </div>
      </div>
    </section>
  );
}
