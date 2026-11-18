'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the URL means "show the hanger": `/` with no hash.
 *
 * The router never fires `hashchange` for `pushState`, so history writes are wrapped once and
 * every change is broadcast here. The hub is derived from the URL alone, which is what makes
 * browser back/forward, direct links and Back to Hanger behave without any extra state.
 */

const listeners: Array<() => void> = [];
let patched = false;

function emit() {
  listeners.slice().forEach((listener) => listener());
}

function patchHistory() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  (['pushState', 'replaceState'] as const).forEach((method) => {
    const original = window.history[method];
    window.history[method] = function patchedHistoryMethod(this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      // The router writes history from inside a React insertion effect, where subscribers must not
      // set state; announce the change once that synchronous work has finished.
      queueMicrotask(emit);
      return result;
    } as History['pushState'];
  });
  window.addEventListener('popstate', emit);
  window.addEventListener('hashchange', emit);
}

export function isHubUrl(): boolean {
  return window.location.pathname === '/' && (window.location.hash === '' || window.location.hash === '#');
}

function subscribe(listener: () => void) {
  patchHistory();
  listeners.push(listener);
  return () => {
    const at = listeners.indexOf(listener);
    if (at >= 0) listeners.splice(at, 1);
  };
}

/** Which home-page section a URL hash opens (Awards belongs with Work), or `null` for any other hash. */
export function sectionForHash(hash: string): 'projects' | 'experience' | 'contact' | null {
  switch (hash.replace('#', '')) {
    case 'projects':
    case 'awards':
      return 'projects';
    case 'experience':
      return 'experience';
    case 'contact':
      return 'contact';
    default:
      return null;
  }
}

/** The current path and hash, as one string: it changes whenever the visitor goes anywhere. */
export function useLocationKey(): string | null {
  return useSyncExternalStore<string | null>(subscribe, () => window.location.pathname + window.location.hash, () => null);
}

/** `null` until the client knows (server render and the first hydration pass). */
export function useHubUrl(): boolean | null {
  return useSyncExternalStore<boolean | null>(subscribe, isHubUrl, () => null);
}

/**
 * Where the rack was left, kept outside React so it survives leaving and re-entering the hub.
 * `phi` is the ring's rotation in radians; `selected` is the last tag entered (-1 for none).
 */
export const rackMemory = { phi: 0, paused: false, selected: -1 };
