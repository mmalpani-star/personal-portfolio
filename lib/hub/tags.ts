/**
 * The four navigation tags on the rack. Exactly four, in the order they appear on the ring.
 * Blurbs are the existing one-line descriptions from each section, not new copy.
 */

export type HubMedia =
  | {
      kind: 'animated';
      /** Animated GIF or animated WebP. */
      src: string;
      alt: string;
      /** Crop focus inside the window when aspect ratios differ (0 = start edge, 1 = end edge). */
      focus: [number, number];
      /** `contain` shows the whole picture at its own aspect ratio instead of cropping it to the window. */
      fit?: 'cover' | 'contain';
    }
  | {
      kind: 'video';
      src: string;
      /** Still shown until the video is playing, and under reduced motion. */
      poster: string;
      alt: string;
      focus: [number, number];
      posterFocus: [number, number];
    };

export type HubTag = {
  id: 'projects' | 'experience' | 'about' | 'contact' | 'skills';
  label: string;
  blurb: string;
  /** Existing route or in-page anchor. */
  href: string;
  /** Where focus lands after entering, for screen-reader and keyboard users. */
  focusSelector: string;
  media: HubMedia;
};

/** The five tags, in the order they hang on the rack. The hanger builds exactly one hanger per entry. */
export const HUB_TAGS: HubTag[] = [
  {
    id: 'projects',
    label: 'Projects',
    blurb: 'Robots, boards and apps I designed, built and broke.',
    href: '/#projects',
    focusSelector: '#projects-title',
    media: {
      kind: 'animated',
      src: '/images/about/arc-reactor.webp',
      alt: 'Animated arc reactor',
      focus: [0.5, 0.5],
    },
  },
  {
    id: 'experience',
    label: 'Experience',
    blurb: 'A robotics team, two internships and the training behind them.',
    href: '/#experience',
    focusSelector: '#experience-title',
    media: {
      kind: 'animated',
      // The existing San Diego Hacks file, used as-is. It is a single-frame image (verified with the
      // browser's own decoder), so it is shown as a still, whole and undistorted.
      src: '/images/about/san d hacks.gif',
      alt: 'The San Diego Hacks team photo',
      focus: [0.5, 0.5],
      fit: 'contain',
    },
  },
  {
    id: 'about',
    label: 'About Me',
    blurb: 'I build things, then find out where they break.',
    href: '/about',
    focusSelector: 'main h1',
    media: {
      kind: 'animated',
      // luffy.webp is the animated Luffy clip; one-piece.webp is a still of the whole crew and already
      // belongs to the About page's own One Piece panel.
      src: '/images/about/luffy.webp',
      alt: 'Luffy tipping his straw hat',
      focus: [0.55, 0.5],
    },
  },
  {
    id: 'contact',
    label: 'Contact',
    blurb: 'Let’s build something useful.',
    href: '/#contact',
    focusSelector: '#contact-title',
    media: {
      kind: 'animated',
      src: '/images/about/tony-stark.gif',
      alt: 'Tony Stark in his workshop',
      focus: [0.5, 0.25],
    },
  },
  {
    id: 'skills',
    label: 'Skills',
    blurb: 'Languages, hardware and tools I work with.',
    href: '/skills',
    focusSelector: 'main h1',
    media: {
      kind: 'animated',
      // The skills animation in the project is saved as `skils.webp` (sic): an animated WebP, 20 frames.
      src: '/images/about/skils.webp',
      alt: 'Animated skills graphic',
      focus: [0.5, 0.5],
    },
  },
];
