import { Reveal, WordReveal } from '@/components/animation';
import { technicalInterests } from '@/data/site-data';
import styles from './Philosophy.module.css';

const loop = [
  { title: 'Understand', detail: 'Take the system apart — mechanics, electronics, control.' },
  { title: 'Prototype', detail: 'Build a physical version, however rough.' },
  { title: 'Experiment', detail: 'Run it, measure it, find where it breaks.' },
  { title: 'Iterate', detail: 'Fix, rebuild, and go around again.' },
];

export function Philosophy() {
  return (
    <section id="philosophy" className={`section ${styles.section}`} aria-labelledby="philosophy-title">
      <div className="page-shell">
        <Reveal>
          <div className="label">01 — Why robotics</div>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 id="philosophy-title" className={styles.statement}>
            Robots should extend what people <em>can do.</em>
          </h2>
        </Reveal>

        <div className={styles.body}>
          <WordReveal
            className={styles.manifesto}
            text="Some tasks are dangerous, repetitive, physically demanding, or simply not worth human time. I am interested in building systems that improve productivity without losing the human element at the center of the work."
          />

          <div className={styles.principles}>
            <Reveal className={styles.principle}>
              <span className="label">Focus</span>
              <h3>Practical systems</h3>
              <p>
                My work lives at the intersection of mechanical design, electronics, embedded systems, and intelligent
                control.
              </p>
            </Reveal>
            <Reveal className={styles.principle} delay={0.08}>
              <span className="label">Applications</span>
              <h3>Real work</h3>
              <p>
                I care about warehouse automation, search and rescue, ocean exploration, household automation, and
                industrial systems.
              </p>
            </Reveal>
          </div>
        </div>

        <div className={styles.lower}>
          <div className={styles.loop} aria-labelledby="loop-title">
            <div className={styles.loopHead}>
              <span id="loop-title" className="label">
                How I work
              </span>
              <span className={styles.loopNote}>↻ repeat</span>
            </div>
            <ol className={styles.stages}>
              {loop.map((stage, index) => (
                <Reveal as="li" key={stage.title} className={styles.stage} delay={0.1 + index * 0.12}>
                  <span className={styles.stageIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.stageTitle}>{stage.title}</span>
                  <span className={styles.stageDetail}>{stage.detail}</span>
                </Reveal>
              ))}
            </ol>
          </div>

          <div className={styles.interests}>
            <div className={styles.loopHead}>
              <span className="label">Engineering interests</span>
              <span className={styles.loopNote}>{String(technicalInterests.length).padStart(2, '0')} topics</span>
            </div>
            <ul className={styles.interestList}>
              {technicalInterests.map((interest, index) => (
                <li key={interest} className={`${styles.interest} spotlight`}>
                  <span className={styles.stageIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <span>{interest}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
