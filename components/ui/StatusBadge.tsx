import type { ProjectStatus } from '@/data/site-data';

type StatusBadgeProps = {
  status: ProjectStatus;
  className?: string;
  style?: React.CSSProperties;
};

const statusStyles: Record<ProjectStatus, string> = {
  COMPLETED: 'status-badge status-completed',
  'IN PROGRESS': 'status-badge status-progress',
  PROTOTYPE: 'status-badge status-prototype',
  CONCEPT: 'status-badge status-concept',
  'CURRENTLY BUILDING': 'status-badge status-current',
};

// A small hover joke for builds that are never quite finished.
const jokes: Partial<Record<ProjectStatus, string>> = {
  'IN PROGRESS': 'ETA: one more iteration (said every iteration)',
};

export function StatusBadge({ status, className = '', style }: StatusBadgeProps) {
  return (
    <span className={`${statusStyles[status]} ${className}`.trim()} style={style} data-joke={jokes[status]}>
      {status}
    </span>
  );
}
