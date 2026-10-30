import type { ReactNode } from 'react';

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
};

/** Section title block. With a description, title and copy sit side by side on wide screens. */
export function SectionHeading({ eyebrow, title, description, align = 'left', className = '' }: SectionHeadingProps) {
  const layout = description && align === 'left' ? 'section-heading--split' : '';
  return (
    <div className={`section-heading ${layout} ${align === 'center' ? 'centered' : ''} ${className}`.trim()}>
      <div>
        {eyebrow ? <div className="label section-eyebrow">{eyebrow}</div> : null}
        <h2>{title}</h2>
      </div>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
