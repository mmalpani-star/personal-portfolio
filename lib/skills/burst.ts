/**
 * Flies the skill logos between the backpack's mouth and their places on the page, leaving short
 * brand-coloured trails on a canvas overlay. Pure DOM and canvas: positions are written as transforms
 * relative to each logo's final layout spot, so the layout itself never moves.
 */

export type BurstItem = {
  el: HTMLElement;
  /** Trail colour: the brand's own. */
  color: string;
};

type Options = {
  items: BurstItem[];
  /** The opening's current position in viewport px (it can be moving while logos are in flight). */
  getMouth: () => { x: number; y: number };
  direction: 'out' | 'in';
  trails: HTMLCanvasElement;
};

export type Flight = { done: Promise<void>; cancel: () => void };

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeOutBack = (t: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Runner = {
  item: BurstItem;
  end: { x: number; y: number };
  delay: number;
  dur: number;
  lift: number;
  sideways: number;
  spin: number;
  trail: Array<{ x: number; y: number }>;
};

export function flyLogos({ items, getMouth, direction, trails }: Options): Flight {
  const out = direction === 'out';
  // Measure where each logo belongs with no transform applied.
  items.forEach(({ el }) => {
    el.style.transform = 'none';
  });
  const runners: Runner[] = items.map((item, i) => {
    const r = item.el.getBoundingClientRect();
    const order = out ? i : items.length - 1 - i;
    return {
      item,
      end: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      delay: order * 34 + (i % 3) * 22,
      dur: out ? 1150 + (i % 4) * 110 : 760 + (i % 3) * 80,
      lift: 120 + ((i * 53) % 5) * 46,
      sideways: ((i * 37) % 7) - 3,
      spin: (((i * 29) % 9) - 4) * 9,
      trail: [],
    };
  });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ctx = trails.getContext('2d')!;
  const resizeTrails = () => {
    trails.width = Math.round(window.innerWidth * dpr);
    trails.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resizeTrails();

  let cancelled = false;
  let raf = 0;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const t0 = performance.now();
  const total = Math.max(...runners.map((r) => r.delay + r.dur));
  let fade = 0;

  const finish = () => {
    runners.forEach(({ item }) => {
      item.el.style.transform = '';
      // arriving: leave them as they are; leaving the page into the pack: they stay hidden until reset
      item.el.style.opacity = out ? '' : '0';
    });
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    resolveDone();
  };

  const frame = (now: number) => {
    raf = 0;
    if (cancelled) return;
    const t = now - t0;
    const mouth = getMouth();
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    runners.forEach((r) => {
      const raw = clamp((t - r.delay) / r.dur, 0, 1);
      const started = t >= r.delay;
      // out: shoot up and settle; in: pulled back, accelerating
      const u = out ? easeOutCubic(raw) : 1 - easeInCubic(raw);
      const s = mouth;
      const e = r.end;
      const control = { x: lerp(s.x, e.x, 0.45) + r.sideways * 38, y: Math.min(s.y, e.y) - r.lift };
      const inv = 1 - u;
      const x = inv * inv * s.x + 2 * inv * u * control.x + u * u * e.x;
      const y = inv * inv * s.y + 2 * inv * u * control.y + u * u * e.y;

      const scale = out ? 0.18 + 0.82 * easeOutBack(raw) : 1 - 0.82 * easeInCubic(raw);
      const opacity = !started ? 0 : out ? clamp(raw / 0.14, 0, 1) : clamp((1 - raw) / 0.18, 0, 1);
      const rot = out ? r.spin * (1 - raw) : r.spin * raw;
      r.item.el.style.opacity = String(opacity);
      r.item.el.style.transform = `translate3d(${x - e.x}px, ${y - e.y}px, 0) scale(${Math.max(0.01, scale)}) rotate(${rot}deg)`;

      if (started && raw < 1) {
        r.trail.push({ x, y });
        if (r.trail.length > 16) r.trail.shift();
      } else if (r.trail.length) {
        r.trail.shift(); // let the tail catch up and vanish
      }
      const n = r.trail.length;
      if (n > 1) {
        ctx.strokeStyle = r.item.color;
        ctx.shadowColor = r.item.color;
        ctx.shadowBlur = 14;
        for (let j = 1; j < n; j++) {
          const k = j / n;
          ctx.globalAlpha = k * 0.7;
          ctx.lineWidth = 1 + k * 5;
          ctx.beginPath();
          ctx.moveTo(r.trail[j - 1].x, r.trail[j - 1].y);
          ctx.lineTo(r.trail[j].x, r.trail[j].y);
          ctx.stroke();
        }
      }
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (t < total || runners.some((r) => r.trail.length)) {
      raf = requestAnimationFrame(frame);
    } else {
      fade = 1;
      finish();
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    done,
    cancel() {
      if (cancelled || fade) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      runners.forEach(({ item }) => {
        item.el.style.transform = '';
        item.el.style.opacity = '';
      });
      resolveDone();
    },
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
