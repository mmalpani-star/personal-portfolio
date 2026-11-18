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
  id: 'projects' | 'experience' | 'about' | 'contact';
  label: string;
  blurb: string;
  /** Existing route or in-page anchor. */
  href: string;
  /** Where focus lands after entering, for screen-reader and keyboard users. */
  focusSelector: string;
  media: HubMedia;
};

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
      kind: 'video',
      src: '/videos/experience/lm555 demo.mp4',
      poster: '/images/experience/lm555.jpg',
      alt: 'An LM555 timer circuit on a perfboard, blinking an LED',
      focus: [0.5, 0.5],
      posterFocus: [0.5, 0.6],
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
];
