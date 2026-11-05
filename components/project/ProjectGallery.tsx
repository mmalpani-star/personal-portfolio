'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';
import { Reveal } from '@/components/animation';
import { Icon } from '@/components/ui/Icon';
import { Lightbox } from '@/components/ui/Lightbox';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import type { ProjectMediaItem } from '@/data/site-data';
import styles from './Project.module.css';

type ImageMedia = Extract<ProjectMediaItem, { type: 'image' }>;

/** Width-to-height ratio; videos without dimensions are treated as 16:9. */
function ratioOf(item: ProjectMediaItem) {
  if (item.type === 'image') return item.width / item.height;
  return item.width && item.height ? item.width / item.height : 16 / 9;
}

/**
 * Justified build log: items in a row share one height and keep their native
 * aspect ratios. Images open a lightbox, videos play inline.
 */
export function ProjectGallery({ media }: { media: ProjectMediaItem[] }) {
  const images = media.filter((item): item is ImageMedia => item.type === 'image');
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);

  return (
    <>
      <div className={styles.gallery} data-sparse={media.length < 3}>
        {media.map((item, index) => {
          const fig = `FIG. ${String(index + 1).padStart(2, '0')}`;
          const ratio = ratioOf(item);
          return (
            <Reveal
              key={item.src}
              className={styles.galleryItem}
              delay={(index % 3) * 0.06}
              style={{ flexGrow: ratio, flexBasis: `${Math.round(ratio * 260)}px` }}
            >
              <figure className={styles.galleryFigure}>
                {item.type === 'image' ? (
                  <button
                    type="button"
                    className={styles.galleryButton}
                    style={{ aspectRatio: `${item.width} / ${item.height}` }}
                    onClick={() => setOpen(images.indexOf(item))}
                    aria-label={`Enlarge: ${item.caption ?? item.alt}`}
                  >
                    <Image src={item.src} alt={item.alt} fill sizes="(max-width: 760px) 100vw, 50vw" />
                    <span className={styles.galleryZoom} aria-hidden="true">
                      <Icon name="plus" size={16} />
                    </span>
                  </button>
                ) : (
                  <div
                    className={styles.galleryVideo}
                    style={{ aspectRatio: `${ratio}` }}
                  >
                    <VideoPlayer src={item.src} poster={item.poster} label={item.alt} />
                  </div>
                )}
                <figcaption className={styles.galleryCaption}>
                  <span className={styles.figIndex}>{fig}</span>
                  <span>{item.caption ?? item.alt}</span>
                  {item.type === 'video' ? <span className={styles.videoTag}>Video</span> : null}
                </figcaption>
              </figure>
            </Reveal>
          );
        })}
      </div>
      <Lightbox items={images} index={open} onClose={close} onNavigate={setOpen} />
    </>
  );
}
