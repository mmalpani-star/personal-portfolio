'use client';

import { useEffect, useRef } from 'react';
import { crosshairIsOn } from './useCrosshair';

/**
 * One passive, rAF-throttled pointer listener for the whole document:
 * - moves the ambient light (transform only, no React re-renders)
 * - feeds `--mx` / `--my` to the `.spotlight` element under the pointer
 * - draws a short hit-marker at the click point while the crosshair cursor is on
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

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || reduceMotion.matches || !crosshairIsOn()) return;
      const marker = document.createElement('span');
      marker.className = 'hit-marker';
      marker.style.left = `${event.clientX}px`;
      marker.style.top = `${event.clientY}px`;
      marker.addEventListener('animationend', () => marker.remove(), { once: true });
      document.body.appendChild(marker);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <div ref={lightRef} className="ambient-light" aria-hidden="true" />;
}
