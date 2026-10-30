'use client';

import Image from 'next/image';
import { Fragment, useCallback, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Lightbox } from '@/components/ui/Lightbox';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import type { Experience } from '@/data/site-data';
import styles from './Experience.module.css';

type StripItem =
  | { kind: 'image'; index: number; image: NonNullable<Experience['images']>[number] }
  | { kind: 'video'; video: NonNullable<Experience['videos']>[number] };

/**
 * Chronological build sequence for an experience: the training circuit
 * (photo + demo video) followed by the PCB iterations.
 */
export function IterationStrip({ images = [], videos = [] }: Pick<Experience, 'images' | 'videos'>) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const [first, ...rest] = images;
  const items: StripItem[] = [
    ...(first ? [{ kind: 'image' as const, index: 0, image: first }] : []),
    ...videos.map((video) => ({ kind: 'video' as const, video })),
    ...rest.map((image, i) => ({ kind: 'image' as const, index: i + 1, image })),
  ];

  return (
    <>
      <ol className={styles.strip} aria-label="Build sequence">
        {items.map((item, position) => {
          const previous = items[position - 1];
          const isRevision = item.kind === 'image' && previous?.kind === 'image' && previous.image.label?.startsWith('PCB');
          return (
          <Fragment key={item.kind === 'image' ? item.image.src : item.video.src}>
            {item.kind === 'image' && item.image.label?.startsWith('PCB') && !isRevision ? (
              <li className={styles.stripBreak} aria-hidden="true" />
            ) : null}
            {isRevision ? (
              <li className={styles.stripArrow} aria-hidden="true">
                <Icon name="arrow-right" size={16} />
              </li>
            ) : null}
            <li className={styles.stripItem}>
              {item.kind === 'image' ? (
                <button
                  type="button"
                  className={styles.stripMedia}
                  style={{ aspectRatio: `${item.image.width} / ${item.image.height}` }}
                  onClick={() => setOpen(item.index)}
                  aria-label={`Enlarge: ${item.image.caption ?? item.image.alt}`}
                >
                  <Image src={item.image.src} alt={item.image.alt} fill sizes="320px" style={{ objectFit: 'cover' }} />
                  <span className={styles.stripZoom} aria-hidden="true">
                    <Icon name="plus" size={14} />
                  </span>
                </button>
              ) : (
                <div className={styles.stripMedia} style={{ aspectRatio: '910 / 512' }}>
                  <VideoPlayer src={item.video.src} poster={item.video.poster} label={item.video.alt} />
                </div>
              )}
              <span className={styles.stripCaption}>
                <span className={styles.stripLabel}>
                  {item.kind === 'image' ? item.image.label ?? 'Photo' : 'Demo'}
                </span>
                {item.kind === 'image' ? item.image.caption : item.video.caption}
              </span>
            </li>
          </Fragment>
          );
        })}
      </ol>
      <Lightbox items={images} index={open} onClose={close} onNavigate={setOpen} />
    </>
  );
}
