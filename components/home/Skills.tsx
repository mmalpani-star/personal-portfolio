import { verifiedSkills } from '@/data/site-data';
import styles from './Capabilities.module.css';

const groups = [
  { key: 'programming', title: 'Programming', items: verifiedSkills.programming },
  { key: 'engineering', title: 'Engineering', items: verifiedSkills.engineering },
  { key: 'software', title: 'Software & tools', items: verifiedSkills.software },
] as const;

/** Spec-sheet style skills table. */
export function Skills() {
  return (
    <div className={styles.skills}>
      {groups.map((group, groupIndex) => (
        <div key={group.key} className={`${styles.skillGroup} spotlight`}>
          <div className={styles.skillHead}>
            <span className={styles.skillCode}>S.{groupIndex + 1}</span>
            <h3 className={styles.skillTitle}>{group.title}</h3>
            <span className={styles.skillCount}>{String(group.items.length).padStart(2, '0')}</span>
          </div>
          <ul className={styles.skillList}>
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
