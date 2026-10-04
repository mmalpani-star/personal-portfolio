import type { ReactNode } from 'react';

type MediaFrameProps = {
  children: ReactNode;
  caption?: string;
  metadata?: string;
  className?: string;
};

export function MediaFrame({ children, caption, metadata, className = '' }: MediaFrameProps) {
  return (
    <figure className={`media-frame ${className}`.trim()}>
      <div className="media-shell">{children}</div>
      {(caption || metadata) && (
        <figcaption className="media-caption">
          {caption ? <span>{caption}</span> : null}
          {metadata ? <span className="media-meta">{metadata}</span> : null}
        </figcaption>
      )}
    </figure>
  );
}
