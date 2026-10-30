import Image from 'next/image';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import type { ProjectMediaItem } from '@/data/site-data';

type ProjectMediaFrameProps = {
  media: ProjectMediaItem;
  metadata?: string;
  priority?: boolean;
  /**
   * `natural`: render at the media's own aspect ratio (images and full video players).
   * `cover`: fill a box, cropping to fit. The box uses `aspectRatio` when given,
   * otherwise the media's own ratio, so nothing is forced into 4:3 by default.
   */
  fit?: 'cover' | 'natural';
  aspectRatio?: string;
  /** Videos only. Use `preview` for lightweight looping previews on overview pages. */
  videoMode?: 'player' | 'preview';
  sizes?: string;
  className?: string;
};

function nativeRatio(media: ProjectMediaItem) {
  if (media.type === 'image') return `${media.width} / ${media.height}`;
  return media.width && media.height ? `${media.width} / ${media.height}` : '16 / 9';
}

export function ProjectMediaFrame({
  media,
  metadata,
  priority = false,
  fit = 'natural',
  aspectRatio,
  videoMode = 'player',
  sizes = '(max-width: 768px) 100vw, 1240px',
  className = '',
}: ProjectMediaFrameProps) {
  const isPreview = media.type === 'video' && videoMode === 'preview';
  const useBox = fit === 'cover' || isPreview;

  return (
    <MediaFrame
      caption={media.caption}
      metadata={metadata}
      className={`project-media-frame project-media-frame--${media.type} ${className}`.trim()}
    >
      {media.type === 'image' ? (
        useBox ? (
          <div className="media-box" style={{ aspectRatio: aspectRatio ?? nativeRatio(media) }}>
            <Image
              src={media.src}
              alt={media.alt}
              fill
              priority={priority}
              style={{ objectFit: 'cover' }}
              sizes={sizes}
            />
          </div>
        ) : (
          <Image
            src={media.src}
            alt={media.alt}
            width={media.width}
            height={media.height}
            priority={priority}
            style={{ width: '100%', height: 'auto' }}
            sizes={sizes}
          />
        )
      ) : useBox ? (
        <div className="media-box" style={{ aspectRatio: aspectRatio ?? nativeRatio(media) }}>
          <VideoPlayer
            src={isPreview ? media.previewSrc ?? media.src : media.src}
            poster={media.poster}
            label={media.alt}
            mode={videoMode}
          />
          {isPreview ? <span className="video-preview-badge">Preview</span> : null}
        </div>
      ) : (
        <VideoPlayer src={media.src} poster={media.poster} label={media.alt} mode="player" />
      )}
    </MediaFrame>
  );
}
