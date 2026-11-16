'use client';

import { useMissionsVisited } from '@/components/effects/missions';
import styles from './Work.module.css';

/** "Inspected 1/3" readout for the flagship cards; fills in as case studies are opened. */
export function MissionProgress({ slugs }: { slugs: string[] }) {
  const visited = useMissionsVisited();
  const done = slugs.filter((slug) => visited.includes(slug)).length;

  return (
    <p className={styles.progress}>
      <span className={styles.pips} aria-hidden="true">
        {slugs.map((slug) => (
          <i key={slug} data-done={visited.includes(slug)} />
        ))}
      </span>
      Inspected {done}/{slugs.length}
      <span className={styles.progressHint}>{done === slugs.length ? 'Ace.' : 'Open all three for an ace.'}</span>
    </p>
  );
}
