/**
 * Moves the skill logos between the backpack's mouth and their places on the page.
 *
 * Deliberately plain: each logo glides along a short arc with a single ease and a small stagger, fading in as it
 * leaves the bag (or out as it returns). No trails, no spin, no overshoot. Positions are transforms relative to
 * each logo's final layout spot, so the layout itself never moves.
 */

export type BurstItem = { el: HTMLElement };

type Options = {
  items: BurstItem[];
  /** The opening's current position in viewport px (it can be moving while logos are in flight). */
  getMouth: () => { x: number; y: number };
  direction: 'out' | 'in';
};

export type Flight = { done: Promise<void>; cancel: () => void };

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function flyLogos({ items, getMouth, direction }: Options): Flight {
  const out = direction === 'out';
  // Measure where each logo belongs with no transform applied, and hide them until their turn.
  items.forEach(({ el }) => {
    el.style.transform = 'none';
  });
  const runners = items.map((item, i) => {
    const r = item.el.getBoundingClientRect();
    const order = out ? i : items.length - 1 - i;
    return {
      item,
      end: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      delay: order * 40,
      dur: out ? 950 : 650,
    };
  });
  runners.forEach(({ item }) => {
    if (out) item.el.style.opacity = '0';
  });

  let cancelled = false;
  let raf = 0;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const t0 = performance.now();
  const total = Math.max(...runners.map((r) => r.delay + r.dur));

  const finish = () => {
    runners.forEach(({ item }) => {
      item.el.style.transform = '';
      item.el.style.opacity = out ? '' : '0'; // returning: left hidden until the page resets them
    });
    resolveDone();
  };

  const frame = (now: number) => {
    raf = 0;
    if (cancelled) return;
    const t = now - t0;
    const mouth = getMouth();
    runners.forEach((r) => {
      const raw = clamp((t - r.delay) / r.dur, 0, 1);
      const u = out ? easeOut(raw) : 1 - easeIn(raw); // 1 = at its place, 0 = in the bag
      // a gentle arc: the path bows upward a little instead of running dead straight
      const x = lerp(mouth.x, r.end.x, u);
      const y = lerp(mouth.y, r.end.y, u) - Math.sin(u * Math.PI) * 36;
      const started = t >= r.delay;
      const opacity = !started ? 0 : out ? clamp(raw / 0.25, 0, 1) : clamp((1 - raw) / 0.3, 0, 1);
      const scale = 0.7 + 0.3 * u;
      r.item.el.style.opacity = String(opacity);
      r.item.el.style.transform = `translate3d(${x - r.end.x}px, ${y - r.end.y}px, 0) scale(${scale})`;
    });
    if (t < total) raf = requestAnimationFrame(frame);
    else finish();
  };
  raf = requestAnimationFrame(frame);

  return {
    done,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      runners.forEach(({ item }) => {
        item.el.style.transform = '';
        item.el.style.opacity = '';
      });
      resolveDone();
    },
  };
}
