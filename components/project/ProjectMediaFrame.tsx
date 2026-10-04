import Image from 'next/image';
import { MediaFrame } from '@/components/ui/MediaFrame';
import type { ProjectMediaItem } from '@/data/site-data';

type ProjectMediaFrameProps = {
  media: ProjectMediaItem;
  metadata?: string;
  priority?: boolean;
  fit?: 'cover' | 'natural';
  className?: string;
};

export function ProjectMediaFrame({
  media,
  metadata,
  priority = false,
  fit = 'natural',
  className = '',
}: ProjectMediaFrameProps) {
  return (
    <MediaFrame
      caption={media.caption}
      metadata={metadata}
      className={`project-media-frame project-media-frame--${media.type} ${className}`.trim()}
    >
      {media.type === 'image' ? (
        fit === 'cover' ? (
          <div className="project-media-cover">
            <Image
              src={media.src}
              alt={media.alt}
              fill
              priority={priority}
              loading={priority ? 'eager' : 'lazy'}
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, 1180px"
            />
          </div>
        ) : (
          <Image
            src={media.src}
            alt={media.alt}
            width={media.width}
            height={media.height}
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            style={{ width: '100%', height: 'auto' }}
            sizes="(max-width: 768px) 100vw, 1180px"
          />
        )
      ) : fit === 'cover' ? (
        <div className="project-media-cover project-media-cover--video">
          <video
            src={media.src}
            aria-label={media.alt}
            poster={media.poster}
            controls
            playsInline
            muted
            preload="metadata"
          />
        </div>
      ) : (
        <video
          src={media.src}
          aria-label={media.alt}
          poster={media.poster}
          controls
          playsInline
          muted
          preload="metadata"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      )}
    </MediaFrame>
  );
}
