import { TapeShelf } from '@/components/experience/TapeShelf';
import { CollabSection } from '@/components/shared/CollabSection';
import { experienceStory } from '@/data/experience-story';
import styles from './Experience.module.css';

/** Oldest on the left, newest on the right; the shelf opens on the newest. */
const shelfOrder = [...experienceStory].reverse();

/**
 * Experience as a shelf of tape boxes, one per experience. Pick one and it turns to show its cover;
 * open it and a sheet grows out of the cover with the full story, photos, clips and models.
 */
export function Experience() {
  return (
    <section id="experience" className={styles.section} aria-labelledby="experience-title">
      <div className={styles.wrap}>
        <header className={styles.heading}>
          <span className="section-index">01</span>
          <h2 id="experience-title" className={styles.title}>Experience</h2>
        </header>
        <TapeShelf entries={shelfOrder} />
      </div>

      <CollabSection idPrefix="experience-collab" />
    </section>
  );
}
