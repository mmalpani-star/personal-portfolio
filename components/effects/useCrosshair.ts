'use client';

import { useCallback, useEffect, useState } from 'react';

const storageKey = 'crosshair';
const changeEvent = 'crosshair-change';

/**
 * Inline script for the document head: turns the crosshair cursor on before
 * first paint on hover-capable fine pointers, unless the visitor switched it off.
 * The cursor itself is plain CSS keyed off `html[data-crosshair="on"]`.
 */
export const crosshairBootScript = `try{if(localStorage.getItem('${storageKey}')!=='off'&&matchMedia('(hover: hover) and (pointer: fine)').matches)document.documentElement.dataset.crosshair='on'}catch(e){}`;

export const crosshairIsOn = () => document.documentElement.dataset.crosshair === 'on';

/** Reads and toggles the crosshair cursor; the choice is remembered per browser. */
export function useCrosshair() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(crosshairIsOn());
    sync();
    window.addEventListener(changeEvent, sync);
    return () => window.removeEventListener(changeEvent, sync);
  }, []);

  const toggle = useCallback(() => {
    const next = !crosshairIsOn();
    if (next) document.documentElement.dataset.crosshair = 'on';
    else delete document.documentElement.dataset.crosshair;
    try {
      localStorage.setItem(storageKey, next ? 'on' : 'off');
    } catch {
      // Storage can be blocked; the toggle still works for this page view.
    }
    window.dispatchEvent(new Event(changeEvent));
  }, []);

  return { on, toggle };
}
