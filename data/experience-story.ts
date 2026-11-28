/**
 * Text for the Experience section. Everything here comes from the portfolio's existing content or from what the
 * owner supplied (the SanD Hacks post and Devpost page); nothing is inferred. Dates are shown only where known.
 */

export type StoryLink = { label: string; href: string; internal?: boolean };

/** One picture, clip or 3D model in an experience's gallery. */
export type GalleryItem =
  | { kind: 'image'; src: string; w: number; h: number; alt: string; caption: string }
  | { kind: 'video'; src: string; poster: string; label: string; caption: string }
  | { kind: 'pcb'; caption: string; note?: string }
  | { kind: 'hardware'; caption: string; note?: string };

/** How the experience looks as a tape on the shelf: a duotone print of its own photo in its own colours. */
export type ShelfLook = {
  /** Short name printed on the spine and cover. */
  short: string;
  /** Year tab it belongs to. */
  year: string;
  /** Photo printed on the cover and the detail poster, and where to centre the crop. */
  poster: string;
  focus: string;
  /** Box colour, the print's dark and light inks, and the colour of type on the box. */
  card: string;
  dark: string;
  light: string;
  type: string;
};

export type StoryEntry = {
  id: 'triton' | 'sandhacks' | 'borderpulse' | 'starlabs' | 'iitk';
  title: string;
  /** The organization's mark, shown above the title. */
  logo?: { src: string; alt: string; width: number; height: number };
  organization: string;
  /** What the organization is, where the portfolio already says so. */
  descriptor?: string;
  dates?: string;
  current?: boolean;
  intro: string;
  /** What I did, in order. */
  points: string[];
  /** A short list of what the project itself was, kept apart from my own part. */
  project?: { heading: string; points: string[] };
  achievement?: string;
  links?: StoryLink[];
  shelf: ShelfLook;
  gallery: GalleryItem[];
};

export const experienceStory: StoryEntry[] = [
  {
    id: 'triton',
    title: 'Electronics Member',
    logo: { src: '/images/experience/triton-robotics-logo.png', alt: 'Triton Robotics logo', width: 146, height: 120 },
    organization: 'Triton Robotics',
    descriptor: 'UC San Diego',
    dates: 'Aug 2026 – Present',
    current: true,
    intro: 'Training on real boards, then a capstone of my own: a CAN FD transceiver breakout board, taken from PCB V1 to PCB V3.',
    points: [
      'Built an LM555 timer circuit on a general-purpose board during week 1 and week 3 of training',
      'Reviewed an older center-board design for power and signal distribution, then modified the center-board PCB in week 2',
      'Designed and built a CAN FD transceiver breakout board as the capstone project',
      'Soldered through-hole and SMD components onto boards, assembled PCBs and reviewed datasheets',
    ],
    shelf: { short: 'Triton Robotics', year: '2026', poster: '/images/experience/triton-robotics-purdue-arcc.jpg', focus: '50% 62%', card: '#E2B93B', dark: '#141414', light: '#F3E6B8', type: '#141414' },
    gallery: [
      { kind: 'image', src: '/images/experience/triton-robotics-purdue-arcc.jpg', w: 802, h: 602, alt: 'Three Triton Robotics robots, numbered 1 and 3 visible, in front of the Purdue University arch', caption: "ARCC 2026 · Triton Robotics' three robots at Purdue University" },
      { kind: 'pcb', caption: 'Capstone · CAN FD breakout board, 3D (drag to turn)', note: 'The CAN FD board model is the EasyEDA 3D export of the final design (PCB_caps_4).' },
      { kind: 'image', src: '/images/experience/caps_3.png', w: 498, h: 792, alt: 'CAN FD breakout board PCB Version 3 layout', caption: 'Capstone · PCB V3 layout' },
      { kind: 'image', src: '/images/experience/lm555.jpg', w: 827, h: 1536, alt: 'LM555 timer circuit prototype on a perfboard', caption: 'Weeks 1 & 3 · the LM555 timer circuit on a perfboard' },
      { kind: 'video', src: '/videos/experience/lm555 demo.mp4', poster: '/images/experience/lm555-demo-poster.jpg', label: 'LM555 timer demonstration', caption: 'Weeks 1 & 3 · LM555 demonstration' },
    ],
  },
  {
    id: 'sandhacks',
    title: 'SanD Hacks — Sitwise',
    organization: 'SanD Hacks',
    descriptor: 'A 26-hour UCSD hackathon hosted by CSE Society with Major League Hacking',
    dates: '2026',
    intro:
      'Our team built Sitwise, an AI-powered posture correction and coaching system, in 26 hours.',
    points: ['Worked on the hardware for the chair attachment', 'Edited the demo video'],
    project: {
      heading: 'About Sitwise',
      points: [
        'Computer vision tracks sitting habits and detects posture changes',
        'Personalized exercises, insights and real-time posture nudges',
        'Built with MediaPipe, OpenCV, React, Flask, Gemini and Tiger Data',
        'Includes a custom, 3D-printed smartphone camera mount',
      ],
    },
    achievement: 'Winner — MLH Best Use of Tiger Data',
    links: [
      { label: 'LinkedIn post', href: 'https://lnkd.in/p/gR9Q_R_Z' },
      { label: 'GitHub', href: 'https://lnkd.in/gXPuN7WM' },
      { label: 'Devpost', href: 'https://devpost.com/software/sitwise' },
      { label: 'YouTube demo', href: 'https://lnkd.in/gKCWtzM4' },
    ],
    shelf: { short: 'SanD Hacks', year: '2026', poster: '/images/experience/sand-hacks-team.jpg', focus: '50% 70%', card: '#D9532B', dark: '#1A1410', light: '#F3D9C6', type: '#F6EDE3' },
    gallery: [
      { kind: 'image', src: '/images/experience/sand-hacks-team.jpg', w: 2524, h: 1684, alt: "The Sitwise team at SanD Hacks in front of the winners' slide", caption: 'The Sitwise team at SanD Hacks' },
      { kind: 'image', src: '/images/experience/sand-hacks-hardware.jpg', w: 1200, h: 1600, alt: 'Two people at a table, one holding the black printed arm of the chair attachment with a red and a green part at its end', caption: 'The chair-attachment hardware I worked on' },
      { kind: 'hardware', caption: 'Chair attachment · 3D (drag to turn)', note: "The four printed parts are from the CAD files; the lower jaw and screws are modelled from my description. The arm root is placed from its holes; the arm tip's notched end and the cradle's boss sitting in it, tilted up, follow my description; the arm overlap is an estimate." },
    ],
  },
  {
    id: 'borderpulse',
    title: 'BorderPulse — Compiled-2026 UCSD Hackathon',
    organization: 'cOmpiled-2026',
    descriptor: 'UC San Diego hackathon',
    intro:
      'BorderPulse is the project I built at the Compiled-2026 UCSD Hackathon: a logistics platform concept that helps dispatchers and receivers judge border-crossing conditions, spot delays and decide on rerouting.',
    points: [
      'Border-condition and delay awareness for rerouting decisions',
      'An automated driver-communication workflow that can contact truck drivers with rerouting instructions',
      'Presented BorderPulse on the cOmpiled-2026 stage and ran the product demonstration',
    ],
    achievement: 'Top 7 of 200+ teams · 441 participants',
    links: [
      { label: 'Project page', href: '/projects/borderpulse', internal: true },
      { label: 'GitHub', href: 'https://github.com/mmalpani-star/borderpulse' },
    ],
    shelf: { short: 'BorderPulse', year: '2026', poster: '/images/projects/borderpulse/borderpulse-presentation-wide.jpeg', focus: '50% 45%', card: '#2E7D74', dark: '#0F1A19', light: '#D6ECE7', type: '#EEF6F3' },
    gallery: [
      { kind: 'image', src: '/images/projects/borderpulse/borderpulse-presentation-wide.jpeg', w: 2000, h: 1333, alt: 'The BorderPulse team presenting on the cOmpiled-16 stage', caption: 'Presenting BorderPulse on the cOmpiled-16 stage' },
      { kind: 'image', src: '/images/projects/borderpulse/borderpulse-demo-walkthrough.jpeg', w: 2000, h: 1333, alt: 'The BorderPulse product walkthrough projected during the hackathon', caption: 'The product walkthrough' },
    ],
  },
  {
    id: 'starlabs',
    title: 'Mechanical Design & Fabrication Intern',
    organization: 'StarLabs',
    descriptor: 'Space technology / aeronautical rocketry startup',
    dates: 'Jun 2025 – Jul 2025',
    intro: '3D-printed CubeSat model, antenna deployment mechanism, assembly and soldering.',
    points: [
      '3D-printed CubeSat model work',
      'Antenna deployment mechanism design and testing support',
      'Assembly and soldering support',
    ],
    shelf: { short: 'StarLabs', year: '2025', poster: '/images/experience/starlabs-team.jpeg', focus: '50% 55%', card: '#1F3FB0', dark: '#0D1230', light: '#DCE3F7', type: '#EEF1FB' },
    gallery: [
      { kind: 'image', src: '/images/experience/starlabs-team.jpeg', w: 2048, h: 1152, alt: 'The StarLabs team standing in front of a rocket', caption: 'The StarLabs team' },
      { kind: 'image', src: '/images/experience/starlabs-all-teams.jpeg', w: 1280, h: 960, alt: 'All the StarLabs teams together in the workshop, holding a rocket body', caption: 'All the teams' },
    ],
  },
  {
    id: 'iitk',
    title: 'Machine Learning Intern',
    organization: 'IIT Kanpur / Techkriti',
    dates: 'Jan 2025 – Feb 2025',
    intro: 'An SVM handwritten-digit classifier in Python, plus the IIT Kanpur Python for AI/ML certification.',
    points: [
      'Fundamental machine learning and linear algebra study',
      'SVM-based handwritten digit classifier using Python and scikit-learn',
      'Completed the IIT Kanpur Certification Program on Python for Artificial Intelligence, Machine Learning, and Deep Learning, organized by the Department of Electrical Engineering (1–28 June 2024)',
    ],
    shelf: { short: 'IIT Kanpur', year: '2025', poster: '/images/experience/iitk-python-ai-ml-certificate.jpg', focus: '50% 40%', card: '#8C2F39', dark: '#1B0C0E', light: '#F0DDD5', type: '#F7ECE8' },
    gallery: [
      { kind: 'image', src: '/images/experience/iitk-python-ai-ml-certificate.jpg', w: 1400, h: 939, alt: 'IIT Kanpur certificate for the Certification Program on Python for Artificial Intelligence, Machine Learning, and Deep Learning', caption: 'Python for AI, ML & Deep Learning certificate' },
    ],
  },
];
