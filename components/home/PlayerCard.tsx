'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { education, playerCard } from '@/data/site-data';
import styles from './StatsTrophies.module.css';

/**
 * Self-assessed rating card. The numbers come from `playerCard` in the site
 * data; bars fill once when the card scrolls into view.
 */
export function PlayerCard() {
  const reduceMotion = useReducedMotion();
  const university = education[0];

  return (
    <article className={`${styles.card} corners`} aria-labelledby="player-card-name">
      <header className={styles.cardHead}>
        <div className={styles.overall}>
          <span className={styles.overallValue}>{playerCard.overall}</span>
          <span className={styles.overallLabel}>OVR</span>
        </div>
        <div className={styles.identity}>
          <span className={styles.position}>{playerCard.position}</span>
          <span id="player-card-name" className={styles.name}>
            Madhav Malpani
          </span>
          <span className={styles.club}>
            UC San Diego · Class of {university.expectedGraduation?.split(' ').pop()}
          </span>
        </div>
      </header>

      <motion.dl
        className={styles.stats}
        initial="empty"
        whileInView="filled"
        viewport={{ once: true, amount: 0.3 }}
      >
        {playerCard.stats.map((stat, index) => (
          <div key={stat.code} className={styles.stat}>
            <dt>
              <span className={styles.statCode}>{stat.code}</span>
              <span className={styles.statName}>{stat.name}</span>
            </dt>
            <dd>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.bar} aria-hidden="true">
                <motion.span
                  className={styles.barFill}
                  style={{ width: `${stat.value}%` }}
                  variants={{ empty: { scaleX: 0 }, filled: { scaleX: 1 } }}
                  transition={
                    reduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 + index * 0.07 }
                  }
                />
              </span>
              <span className={styles.statBasis}>{stat.basis}</span>
            </dd>
          </div>
        ))}
      </motion.dl>

      <footer className={styles.cardFoot}>
        <span>{playerCard.note}</span>
        <span>Not a benchmark</span>
      </footer>
    </article>
  );
}
