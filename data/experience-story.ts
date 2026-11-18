/**
 * Text for the Experience section. Everything here comes from the portfolio's existing content or from what the
 * owner supplied (the SanD Hacks post and Devpost page); nothing is inferred. Dates are shown only where known.
 */

export type StoryLink = { label: string; href: string; internal?: boolean };

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
      'Developed PCB Version 1 and PCB Version 3 in chronological order',
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
  },
  {
    id: 'borderpulse',
    title: 'BorderPulse — Compiled-16 UCSD Hackathon',
    organization: 'cOmpiled-16',
    descriptor: 'UC San Diego hackathon',
    intro:
      'BorderPulse is the project I built at the Compiled-16 UCSD Hackathon: a logistics platform concept that helps dispatchers and receivers judge border-crossing conditions, spot delays and decide on rerouting.',
    points: [
      'Border-condition and delay awareness for rerouting decisions',
      'An automated driver-communication workflow that can contact truck drivers with rerouting instructions',
      'Presented BorderPulse on the cOmpiled-16 stage and ran the product demonstration',
    ],
    achievement: 'Top 7 of 200+ teams · 441 participants',
    links: [
      { label: 'Project page', href: '/projects/borderpulse', internal: true },
      { label: 'GitHub', href: 'https://github.com/mmalpani-star/borderpulse' },
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
  },
];
