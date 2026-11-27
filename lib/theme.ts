/**
 * Light / dark theme. The source of truth is `html[data-theme]`, which the boot script in app/layout.tsx
 * sets before first paint (saved choice, else the OS preference, else dark). Every ThemeToggle on the page
 * reads and writes it through here, so the navbar slider and the hanger slider always agree.
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

/** Browser-chrome colour per theme (matches --bg). */
const THEME_COLOR: Record<Theme, string> = { dark: '#070709', light: '#ffffff' };

/** Runs inline in <head> before first paint: saved choice, else the OS preference, else dark. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t;if(t==='light')document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content','#ffffff')})})}catch(e){document.documentElement.dataset.theme='dark'}})();`;

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Server render has no theme; the toggle renders as dark and corrects itself on hydration. */
export function getServerTheme(): Theme {
  return 'dark';
}

export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLOR[theme]));
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode: the choice just won't persist */
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => apply(theme));
  else apply(theme);
}
