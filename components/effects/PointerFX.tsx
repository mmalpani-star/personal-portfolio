'use client';

import { useEffect, useRef } from 'react';

/**
 * One passive, rAF-throttled pointer listener for the whole document:
 * - moves the ambient light (transform only, no React re-renders)
 * - feeds `--mx` / `--my` to the `.spotlight` element under the pointer
 * Inactive on touch / coarse pointers. The ambient light is hidden under
 * reduced motion (CSS); spotlights still respond since they don't move content.
 */
export function PointerFX() {
  const lightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!finePointer.matches) return;

    const light = lightRef.current;
    let frame = 0;
    let x = 0;
    let y = 0;
    let target: HTMLElement | null = null;

    const update = () => {
      frame = 0;
      if (light) light.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (target) {
        const rect = target.getBoundingClientRect();
        target.style.setProperty('--mx', `${x - rect.left}px`);
        target.style.setProperty('--my', `${y - rect.top}px`);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      x = event.clientX;
      y = event.clientY;
      target = (event.target as Element | null)?.closest<HTMLElement>('.spotlight') ?? null;
      if (light && light.dataset.active !== 'true') light.dataset.active = 'true';
      if (!frame) frame = requestAnimationFrame(update);
    };

    const onLeave = () => {
      if (light) light.dataset.active = 'false';
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <div ref={lightRef} className="ambient-light" aria-hidden="true" />;
}
