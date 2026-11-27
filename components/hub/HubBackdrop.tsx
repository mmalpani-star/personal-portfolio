import Image from 'next/image';
import styles from './HubBackdrop.module.css';

type Tile =
  | { kind: 'img'; src: string; w: number; h: number; gif?: string }
  | { kind: 'fact'; big: string; small: string };

const img = (src: string, w: number, h: number, gif?: string): Tile => ({ kind: 'img', src, w, h, gif });
const fact = (big: string, small: string): Tile => ({ kind: 'fact', big, small });

/** Highlights from the site itself: photos from the projects and experiences, the awards, and the anime picks from About. */
const ROWS: Tile[][] = [
  [
    img('/images/projects/quadruped/quadruped_full_build.jpeg', 4, 3),
    fact('Winner', 'SanD Hacks 2026 · MLH Best Use of Tiger Data'),
    img('/images/about/naruto-sasuke-still.jpg', 16, 9, '/images/about/naruto-sasuke.gif'),
    img('/images/projects/cubesat/cubesat-assembly.jpg', 3, 4),
    img('/images/experience/triton-robotics-purdue-arcc.jpg', 4, 3),
    fact('#639', 'Aryabhatta National Math · of 10,000'),
    img('/images/projects/hexapod/hexapod-sketch-1.jpg', 3, 2),
    img('/images/about/sketch-madara.jpg', 10, 7),
  ],
  [
    fact('Top 7', 'cOmpiled-2026 · of 200+ teams'),
    img('/images/projects/borderpulse/borderpulse-presentation-wide.jpeg', 3, 2),
    img('/images/about/one-piece.webp', 16, 9),
    img('/images/projects/hydrosafe/hydrosafe-team.jpg', 3, 4),
    img('/images/projects/hydrosafe/hydrosafe-main.jpg', 4, 3),
    fact('CAN FD', 'Capstone board · PCB V1 → V3'),
    img('/images/projects/tritonspend/tritonspend-dashboard.jpg', 16, 10),
    img('/images/experience/lm555.jpg', 6, 11),
  ],
  [
    img('/images/experience/sand-hacks-team.jpg', 3, 2),
    fact('Top 500', 'ICSC Competition · of 10,000'),
    img('/images/projects/air-quality/aqi-monitor.jpg', 4, 3),
    img('/images/about/luffy.webp', 4, 3),
    img('/images/experience/caps_3.png', 5, 8),
    img('/images/projects/quadruped/quadruped-walking-poster.jpg', 16, 10),
    fact('StarLabs', 'CubeSat antenna deployment'),
    img('/images/projects/quadruped/leg_closeup.jpeg', 4, 3),
  ],
  [
    img('/images/experience/starlabs-all-teams.jpeg', 4, 3),
    img('/images/about/sketch-luffy.jpg', 3, 4),
    fact('#373', 'Ramanujan National Math · of 6,000'),
    img('/images/projects/tritonspend/tritonspend-landing.jpg', 16, 10),
    img('/images/experience/sand-hacks-hardware.jpg', 3, 4),
    img('/images/projects/hexapod/hexapod-first-look.jpg', 4, 3),
    img('/images/about/tony-stark-still.jpg', 1, 1),
    fact('Electronics', 'Triton Robotics · UC San Diego'),
  ],
  [
    img('/images/projects/cubesat/cubesat-team.png', 16, 9),
    img('/images/projects/hydrosafe/hydrosafe-cad.jpeg', 8, 7),
    fact('Rank 411', 'Mental Math World Cup · of 8,600'),
    img('/images/projects/borderpulse/borderpulse-demo-setup.jpeg', 3, 2),
    img('/images/projects/air-quality/aqi-readings.jpg', 3, 4),
    img('/images/projects/quadruped/matplotlib-fk-animation-poster.jpg', 16, 10),
    img('/images/experience/starlabs-team.jpeg', 16, 9),
    img('/images/projects/cubesat/cubesat-model.jpg', 4, 3),
  ],
];

function TileView({ tile }: { tile: Tile }) {
  if (tile.kind === 'fact') {
    return (
      <span className={styles.fact}>
        <strong>{tile.big}</strong>
        <span>{tile.small}</span>
      </span>
    );
  }
  const width = Math.round((142 * tile.w) / tile.h);
  return (
    <span className={styles.pic} style={{ width }}>
      {tile.gif ? (
        <picture>
          {/* the still under reduced motion, the clip otherwise */}
          <source srcSet={tile.src} media="(prefers-reduced-motion: reduce)" />
          <img src={tile.gif} alt="" decoding="async" />
        </picture>
      ) : (
        <Image src={tile.src} alt="" width={width * 2} height={300} sizes={`${width}px`} quality={55} loading="eager" />
      )}
    </span>
  );
}

/**
 * A slow wall of highlights behind the hanger: three tilted rows drifting in alternate directions,
 * faded out around the rack so it stays the thing you look at. Purely decorative.
 */
export function HubBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.tilt}>
        {ROWS.map((row, r) => (
          <div key={r} className={styles.row} data-dir={r % 2 ? 'right' : 'left'} style={{ animationDuration: `${100 + (r % 3) * 22}s` }}>
            {[0, 1].map((copy) =>
              row.map((tile, i) => <TileView key={`${copy}-${i}`} tile={tile} />),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
