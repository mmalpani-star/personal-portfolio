export type ProjectStatus =
  | 'COMPLETED'
  | 'IN PROGRESS'
  | 'PROTOTYPE'
  | 'CONCEPT'
  | 'CURRENTLY BUILDING';

export type ProjectMediaItem =
  | {
      type: 'image';
      src: string;
      alt: string;
      caption?: string;
      width: number;
      height: number;
    }
  | {
      type: 'video';
      /** Source for full playback (an optimized derivative where one exists). */
      src: string;
      alt: string;
      caption?: string;
      poster?: string;
      /** Short, lightweight clip for homepage previews. Falls back to `src`. */
      previewSrc?: string;
      width?: number;
      height?: number;
    };

/** Controls homepage emphasis: flagship robotics, hardware prototypes, software & hackathons. */
export type ProjectTier = 'flagship' | 'hardware' | 'software';

export type Project = {
  slug: string;
  tier: ProjectTier;
  title: string;
  shortTitle: string;
  category: string;
  status: ProjectStatus;
  statusNote: string;
  summary: string;
  description: string;
  role?: string;
  technologies: string[];
  highlights: string[];
  github?: string;
  externalLinks?: Array<{ label: string; href: string }>;
  sections?: string[];
  nextSteps?: string[];
  /** Optional case-study content. Sections render only when provided. */
  process?: string[];
  challenges?: string[];
  learnings?: string[];
  achievement?: {
    label: string;
    detail: string;
  };
  gallerySection?: {
    eyebrow: string;
    title: string;
  };
  heroMedia?: ProjectMediaItem;
  galleryImages?: ProjectMediaItem[];
  showcaseMedia?: ProjectMediaItem[];
};

export type Experience = {
  title: string;
  organization: string;
  location?: string;
  dates?: string;
  isCurrent?: boolean;
  details?: string[];
  socialLink?: ContactLink;
  images?: Array<{
    src: string;
    alt: string;
    caption?: string;
    /** Short label for iteration sequences, e.g. "PCB V1". */
    label?: string;
    width: number;
    height: number;
  }>;
  videos?: Array<{
    src: string;
    alt: string;
    caption?: string;
    poster?: string;
  }>;
};

export type Education = {
  institution: string;
  degree: string;
  expectedGraduation?: string;
  dates?: string;
  details?: string[];
};

export type Award = {
  name: string;
  detail: string;
  year?: string;
};

export type ContactLink = {
  label: string;
  href: string;
};

export type SecondaryWork = {
  title: string;
  details: string[];
};

export const projects: Project[] = [
  {
    slug: 'quadruped-leg-kinematics',
    tier: 'flagship',
    title: 'Quadruped Leg Kinematics',
    shortTitle: 'Quadruped',
    category: 'Robotics / Kinematics',
    status: 'IN PROGRESS',
    statusNote: 'Kinematics framework developed / physical platform assembled / locomotion in progress.',
    summary:
      'I assembled an open-source quadruped platform with four 3-DOF legs and developed an object-oriented Python kinematics framework for control and workspace visualization.',
    description:
      'I assembled an open-source quadruped platform with four 3-DOF legs. Each leg consists of a Coxa, Femur, and Tibia. I developed a Python object-oriented framework for forward kinematics, inverse kinematics, servo control, joint-angle based control, end-effector coordinate based control, and workspace visualization. The physical quadruped is assembled but is not currently walking, and hardware issues are still being worked through.',
    role: 'Independent builder and developer',
    technologies: ['Python', 'Robotics', 'Kinematics', 'Servo Control'],
    highlights: [
      '4 x 3-DOF leg design',
      'Forward and inverse kinematics framework',
      'Joint-angle and end-effector coordinate control',
      'Workspace visualization',
    ],
    github: 'https://github.com/mmalpani-star/Quadruped-leg-kinematics',
    sections: ['Overview', 'Implementation', 'Current Status'],
    nextSteps: ['Resolve hardware issues', 'Continue locomotion development'],
    heroMedia: {
      type: 'image',
      src: '/images/projects/quadruped/quadruped_full_build.jpeg',
      alt: 'Fully assembled quadruped platform',
      caption: 'The assembled four-leg platform',
      width: 1200,
      height: 1600,
    },
    galleryImages: [
      {
        type: 'image',
        src: '/images/projects/quadruped/leg_closeup.jpeg',
        alt: 'Close-up of a quadruped leg',
        caption: 'Coxa, femur, and tibia leg assembly',
        width: 1600,
        height: 1200,
      },
    ],
    showcaseMedia: [
      {
        type: 'image',
        src: '/images/projects/quadruped/leg_closeup.jpeg',
        alt: 'Close-up of a quadruped leg',
        caption: 'Coxa, femur, and tibia leg assembly',
        width: 1600,
        height: 1200,
      },
    ],
  },
  {
    slug: 'hexapod',
    tier: 'flagship',
    title: 'Custom Hexapod',
    shortTitle: 'Hexapod',
    category: 'Robotics / Mechanical Systems',
    status: 'IN PROGRESS',
    statusNote: 'Mechanical assembly complete / locomotion development ongoing.',
    summary:
      'A custom-built, approximately 70 cm wide hexapod with 18 MG996R servos, an Arduino Mega, and over 20 3D-printed parts.',
    description:
      'A custom-built approximately 70 cm wide hexapod. Hardware includes 18 MG996R servos, an Arduino Mega, and 20+ 3D-printed parts. The work involved mechanical design, 3D printing, servo control, electronics, robot structure, and assembly. The physical robot is assembled but is not currently walking.',
    role: 'Mechanical and electronics builder',
    technologies: ['Arduino Mega', '3D Printing', 'Servo Control', 'Mechanical Design'],
    highlights: [
      'Approx. 70 cm wide robot body',
      '18 MG996R servos',
      '20+ 3D-printed parts',
      'Mechanical assembly complete',
    ],
    sections: ['Overview', 'Mechanical Design', 'Current Status'],
    nextSteps: ['Continue locomotion development'],
    heroMedia: {
      type: 'image',
      src: '/images/projects/hexapod/Hexapod Assembly.jpg',
      alt: 'Full assembled hexapod with blue and white legs and central electronics',
      caption: 'Full assembled Hexapod',
      width: 4032,
      height: 3024,
    },
    galleryImages: [
      { type: 'image', src: '/images/projects/hexapod/hexapod-connections.jpg', alt: 'Hexapod wiring and servo connections', caption: 'Servo and electronics connections', width: 1042, height: 1280 },
      { type: 'image', src: '/images/projects/hexapod/hexapod-sketch-1.jpg', alt: 'Hexapod design sketch', caption: 'Early design sketch', width: 2048, height: 1384 },
      { type: 'image', src: '/images/projects/hexapod/hexapod-sketch-top-view.jpg', alt: 'Hexapod top-view design sketch', caption: 'Top-view layout sketch', width: 1895, height: 1536 },
    ],
    showcaseMedia: [
      { type: 'image', src: '/images/projects/hexapod/hexapod-connections.jpg', alt: 'Hexapod wiring and servo connections', caption: 'Servo and electronics connections', width: 1042, height: 1280 },
      { type: 'image', src: '/images/projects/hexapod/hexapod-sketch-top-view.jpg', alt: 'Hexapod top-view design sketch', caption: 'Top-view design sketch', width: 1895, height: 1536 },
    ],
  },
  {
    slug: 'cubesat-antenna-mechanism',
    tier: 'hardware',
    title: '1U CubeSat Antenna Deployment Mechanism',
    shortTitle: 'CubeSat',
    category: 'Space Systems / Mechanical Design',
    status: 'PROTOTYPE',
    statusNote: 'Prototype and simulation work completed; no flight claim made.',
    summary:
      'A mechanical design and fabrication internship project involving a 3D-printed CubeSat model, antenna deployment mechanism, burn-wire mechanism, and CST Studio electromagnetic simulation.',
    description:
      'I worked as a Mechanical Design and Fabrication Intern at a space-technology startup. I worked as part of a team building a 3D-printed CubeSat model. My work included mechanical design ideas, assembly, soldering, an antenna deployment mechanism, a burn-wire mechanism, a steel tape antenna, CST Studio simulation and visualization, and GPS/communication PCB work. I simulated electromagnetic behavior related to the steel tape antenna using CST Studio and explored antenna deployment concepts inspired by Japanese wood joinery. I also presented CubeSat capabilities and applications to founders and trainees.',
    role: 'Mechanical design and fabrication intern',
    technologies: ['Onshape', 'CST Studio', 'Soldering', 'PCB Work', 'Mechanical Design'],
    highlights: [
      '3D-printed CubeSat model',
      'Antenna deployment concept',
      'Burn-wire mechanism',
      'CST Studio electromagnetic simulation',
    ],
    sections: ['Overview', 'Mechanical Design', 'Simulation'],
    heroMedia: {
      type: 'image',
      src: '/images/projects/cubesat/cubesat-model.jpg',
      alt: '3D-printed CubeSat model',
      caption: 'Physical CubeSat prototype',
      width: 1600,
      height: 1200,
    },
    galleryImages: [
      { type: 'image', src: '/images/projects/cubesat/cubesat-assembly.jpg', alt: 'CubeSat model assembly', caption: 'Assembly and fabrication', width: 960, height: 1280 },
      { type: 'image', src: '/images/projects/cubesat/cubesat-antenna.png', alt: 'CST Studio steel tape antenna simulation', caption: 'CST Studio antenna simulation', width: 1145, height: 514 },
      { type: 'image', src: '/images/projects/cubesat/cubesat-team.png', alt: 'CubeSat project team with the model', caption: 'CubeSat project team', width: 1914, height: 1076 },
    ],
    showcaseMedia: [
      { type: 'image', src: '/images/projects/cubesat/cubesat-antenna.png', alt: 'CST Studio steel tape antenna simulation', caption: 'CST Studio antenna simulation', width: 1145, height: 514 },
      { type: 'image', src: '/images/projects/cubesat/cubesat-team.png', alt: 'CubeSat project team with the model', caption: 'CubeSat project team', width: 1914, height: 1076 },
    ],
  },
  {
    slug: 'air-quality-monitor',
    tier: 'hardware',
    title: 'ESP32 Multi-Sensor Air Quality Monitor',
    shortTitle: 'Air Quality',
    category: 'Embedded Systems / IoT',
    status: 'COMPLETED',
    statusNote: 'Completed prototype and demonstration project.',
    summary:
      'A monitoring station built around an ESP32 that integrates CO2, ozone, temperature, humidity, and air-quality sensors with an ILI9341 TFT display.',
    description:
      'Built an air-quality monitoring station around an ESP32. Hardware includes an ESP32 DevKit, ILI9341 TFT, DHT22, MH-Z19E, MQ-131, and ZP07-MP503. The system monitors CO2, ozone, general air quality, temperature, and humidity. Features include a TFT display, serial data streaming, sensor integration, and embedded firmware. There is a demonstration video and project photography.',
    role: 'Independent embedded systems project',
    technologies: ['ESP32', 'Embedded Systems', 'IoT', 'Firmware', 'TFT Display'],
    highlights: [
      'ESP32-based sensing platform',
      'CO2, ozone, humidity, and temperature monitoring',
      'TFT display and serial streaming',
      'Sensor integration and firmware',
    ],
    github: 'https://github.com/mmalpani-star/AIR-QUALITY-MONITOR',
    sections: ['Overview', 'Implementation', 'Results'],
    heroMedia: {
      type: 'image',
      src: '/images/projects/air-quality/AQI.jpeg',
      alt: 'ESP32 air-quality monitor prototype',
      caption: 'ESP32 multi-sensor monitor',
      width: 4032,
      height: 3024,
    },
    galleryImages: [
      { type: 'image', src: '/images/projects/air-quality/AQI readings.jpeg', alt: 'Measurements shown on the air-quality monitor', caption: 'On-device sensor readings', width: 960, height: 1280 },
      { type: 'video', src: '/videos/projects/air-quality/AQI demo.mp4', previewSrc: '/videos/projects/air-quality/aqi-demo-preview.mp4', poster: '/images/projects/air-quality/aqi-demo-poster.jpg', width: 480, height: 848, alt: 'Air quality monitor demonstration video', caption: 'AQI monitor demo' },
      { type: 'video', src: '/videos/projects/air-quality/AQI monitor side view.mp4', poster: '/images/projects/air-quality/aqi-side-view-poster.jpg', width: 848, height: 480, alt: 'Side view of the air quality monitor', caption: 'Monitor side view' },
    ],
    showcaseMedia: [
      { type: 'image', src: '/images/projects/air-quality/AQI readings.jpeg', alt: 'Measurements shown on the air-quality monitor', caption: 'On-device sensor readings', width: 960, height: 1280 },
      { type: 'video', src: '/videos/projects/air-quality/AQI demo.mp4', previewSrc: '/videos/projects/air-quality/aqi-demo-preview.mp4', poster: '/images/projects/air-quality/aqi-demo-poster.jpg', width: 480, height: 848, alt: 'Air quality monitor demonstration video', caption: 'AQI monitor demo' },
    ],
  },
  {
    slug: 'borderpulse',
    tier: 'software',
    title: 'BorderPulse',
    shortTitle: 'BorderPulse',
    category: 'Hackathon / Logistics',
    status: 'PROTOTYPE',
    statusNote: 'Hackathon prototype demonstrated at cOmpiled-16; not a deployed commercial logistics system.',
    summary:
      'A logistics platform concept for dispatchers and receivers that helps evaluate border-crossing conditions, identify delays, and make rerouting decisions.',
    description:
      'BorderPulse addresses uncertainty in cross-border freight logistics. It helps dispatchers evaluate border-crossing conditions, identify delays, and make rerouting decisions. Its core innovation is an automated driver communication workflow that can contact truck drivers and communicate rerouting instructions, reducing the need for manual coordination.',
    role: 'cOmpiled-16 UCSD Hackathon project',
    technologies: ['Logistics', 'Routing Decisions', 'Driver Communication'],
    github: 'https://github.com/mmalpani-star/borderpulse',
    highlights: [
      'Top 7 at the cOmpiled-16 UCSD Hackathon',
      'Built for dispatchers and receivers navigating cross-border freight uncertainty',
      'Border-condition and delay awareness for rerouting decisions',
      'Automated driver communication workflow concept',
    ],
    sections: ['Overview', 'Hackathon / Presentation'],
    achievement: {
      label: 'cOmpiled-16 UCSD Hackathon',
      detail: 'Top 7 · 441 participants · 200+ teams',
    },
    gallerySection: {
      eyebrow: 'Hackathon / presentation',
      title: 'BorderPulse at cOmpiled-16',
    },
    heroMedia: {
      type: 'image',
      src: '/images/projects/borderpulse/borderpulse-presentation.jpeg',
      alt: 'BorderPulse presentation at the cOmpiled-16 UCSD Hackathon',
      caption: 'BorderPulse presentation',
      width: 2000,
      height: 1333,
    },
    galleryImages: [
      {
        type: 'image',
        src: '/images/projects/borderpulse/borderpulse-demo-setup.jpeg',
        alt: 'BorderPulse demo setup during the cOmpiled-16 presentation',
        caption: 'Demo setup',
        width: 2000,
        height: 1333,
      },
      {
        type: 'image',
        src: '/images/projects/borderpulse/borderpulse-demo-walkthrough.jpeg',
        alt: 'BorderPulse product walkthrough projected during the hackathon',
        caption: 'Product walkthrough',
        width: 2000,
        height: 1333,
      },
      {
        type: 'image',
        src: '/images/projects/borderpulse/borderpulse-presentation-wide.jpeg',
        alt: 'BorderPulse team presentation on the cOmpiled-16 stage',
        caption: 'Presentation stage',
        width: 2000,
        height: 1333,
      },
      {
        type: 'video',
        src: '/videos/projects/borderpulse/borderpulse-720p.mp4',
        previewSrc: '/videos/projects/borderpulse/borderpulse-preview.mp4',
        alt: 'BorderPulse project demonstration video',
        caption: 'BorderPulse demo',
        poster: '/images/projects/borderpulse/borderpulse-demo-poster.jpg',
        width: 1280,
        height: 720,
      },
    ],
    showcaseMedia: [
      {
        type: 'video',
        src: '/videos/projects/borderpulse/borderpulse-720p.mp4',
        previewSrc: '/videos/projects/borderpulse/borderpulse-preview.mp4',
        alt: 'BorderPulse project demonstration video',
        caption: 'BorderPulse demo',
        poster: '/images/projects/borderpulse/borderpulse-demo-poster.jpg',
        width: 1280,
        height: 720,
      },
      {
        type: 'image',
        src: '/images/projects/borderpulse/borderpulse-demo-walkthrough.jpeg',
        alt: 'BorderPulse product walkthrough projected during the hackathon',
        caption: 'Product walkthrough',
        width: 2000,
        height: 1333,
      },
    ],
  },
  {
    slug: 'hydrosafe',
    tier: 'hardware',
    title: 'HydroSafe',
    shortTitle: 'HydroSafe',
    category: 'Environmental Engineering / Embedded Systems / Mechanical Systems',
    status: 'PROTOTYPE',
    statusNote: 'Physical prototype and concept exploration completed for demonstration and presentation.',
    summary:
      'A physical prototype exploring urban flooding and rainwater management through drainage, springs, piezoelectric sensors, and energy-harvesting concepts.',
    description:
      'A physical prototype exploring urban flooding and rainwater management. The prototype combines rainwater drainage, pipes, springs, piezoelectric sensors, mechanical stress, and electrical energy generation concepts. The project explored ways to address water-clogged roads and potholes while experimenting with energy harvesting from mechanical stress. I collaborated with a classmate on hypothetical failure situations and spring-constant ranges. The project was presented at a local science fair to 100+ visitors, including the mayor.',
    role: 'Prototype design and concept exploration',
    technologies: ['Mechanical Design', 'Embedded Systems', 'Sensors', 'Prototype Development'],
    highlights: [
      'Flooding and drainage concept prototype',
      'Pipes, springs, and sensors',
      'Piezoelectric experimentation',
      'Presented to 100+ visitors',
    ],
    externalLinks: [{ label: 'Onshape', href: 'https://cad.onshape.com/documents/438ebb1f40bb653051e5e8/w/b3f7c5fefd5ac8c339d8f030/e/7c8e4e28a8ef38fc77ff96dc' }],
    sections: ['Overview', 'Prototype', 'Presentation'],
    heroMedia: {
      type: 'image',
      src: '/images/projects/hydrosafe/hydrosafe-main.jpg',
      alt: 'HydroSafe physical prototype',
      caption: 'HydroSafe prototype',
      width: 1280,
      height: 960,
    },
    galleryImages: [
      { type: 'image', src: '/images/projects/hydrosafe/hydrosafe-in-progress.jpg', alt: 'HydroSafe prototype during fabrication', caption: 'Prototype in progress', width: 960, height: 1280 },
      { type: 'image', src: '/images/projects/hydrosafe/hydrosafe-interior.jpg', alt: 'Interior of the HydroSafe prototype', caption: 'Interior drainage concept', width: 1280, height: 960 },
      { type: 'image', src: '/images/projects/hydrosafe/hydrosafe-cad.jpeg', alt: 'HydroSafe CAD model', caption: 'CAD model', width: 800, height: 703 },
      { type: 'image', src: '/images/projects/hydrosafe/hydrosafe-team.jpg', alt: 'HydroSafe project team at presentation', caption: 'Project presentation', width: 960, height: 1280 },
    ],
    showcaseMedia: [
      { type: 'image', src: '/images/projects/hydrosafe/hydrosafe-cad.jpeg', alt: 'HydroSafe CAD model', caption: 'CAD model', width: 800, height: 703 },
      { type: 'image', src: '/images/projects/hydrosafe/hydrosafe-in-progress.jpg', alt: 'HydroSafe prototype during fabrication', caption: 'Prototype in progress', width: 960, height: 1280 },
    ],
  },
];

const tierOrder: Record<ProjectTier, number> = { flagship: 0, hardware: 1, software: 2 };

/** Projects in presentation order (stable within each tier). */
export const displayProjects: Project[] = [...projects].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

export type HeroAnnotation = {
  /** Anchor position as a fraction of the image width / height. */
  x: number;
  y: number;
  label: string;
  value: string;
  side: 'left' | 'right';
};

/**
 * Hero callouts. Every value is taken from the verified project data above
 * (hexapod and quadruped highlights / status notes).
 */
export const heroAnnotations: { desktop: HeroAnnotation[]; mobile: HeroAnnotation[]; desktopSpan: string } = {
  desktop: [
    { x: 0.52, y: 0.36, label: 'Hexapod', value: 'Mechanical assembly complete', side: 'right' },
    { x: 0.696, y: 0.61, label: 'Actuation', value: '18 × MG996R servos', side: 'right' },
    { x: 0.886, y: 0.457, label: 'Structure', value: '20+ 3D-printed parts', side: 'left' },
  ],
  desktopSpan: '≈ 70 cm wide',
  mobile: [
    { x: 0.38, y: 0.31, label: 'Quadruped', value: '4 × 3-DOF legs', side: 'right' },
    { x: 0.79, y: 0.62, label: 'Leg', value: 'Coxa · Femur · Tibia', side: 'left' },
  ],
};

export const currentlyBuilding: {
  organization: string;
  team: string;
  location: string;
  dates: string;
  status: ProjectStatus;
  description: string;
} = {
  organization: 'Triton Robotics',
  team: 'Electronics Sub-Team Recruit',
  location: 'UC San Diego',
  dates: 'Aug 2026 – Present',
  status: 'CURRENTLY BUILDING',
  description:
    'Working on the legacy center-board design by reviewing power and signal distribution, modifying the PCB during week 2, and building a LM555 timer circuit on a general-purpose board during training. For the capstone, I am designing and building a CAN FD transceiver breakout board, with PCB Version 1 followed by PCB Version 3.',
};

export const experience: Experience[] = [
  {
    title: 'Mechanical Design & Fabrication Intern',
    organization: 'Space Technology / Aeronautical Rocketry startup',
    dates: 'Jun 2025 – Jul 2025',
    details: ['3D-printed CubeSat model work', 'Antenna deployment mechanism design and testing support', 'Assembly and soldering support'],
  },
  {
    title: 'Machine Learning Trainee',
    organization: 'IIT Kanpur / Techkriti',
    dates: 'Jan 2025 – Feb 2025',
    details: ['Fundamental machine learning and linear algebra study', 'SVM-based handwritten digit classifier using Python and scikit-learn'],
  },
  {
    title: 'Electronics Sub-Team Recruit',
    organization: 'Triton Robotics',
    location: 'UC San Diego',
    dates: 'Aug 2026 – Present',
    isCurrent: true,
    details: [
      'Reviewed an older center-board design for power and signal distribution',
      'Modified the center-board PCB during week 2 of training',
      'Built an LM555 timer circuit on a general-purpose board during week 1 and week 3 training',
      'Designing and building a CAN FD transceiver breakout board as the capstone project',
      'Developed PCB Version 1 and PCB Version 3 in chronological order',
    ],
    images: [
      {
        src: '/images/experience/lm555.jpg',
        alt: 'LM555 timer circuit prototype',
        caption: 'LM555 timer prototype',
        label: 'LM555',
        width: 827,
        height: 1536,
      },
      {
        src: '/images/experience/caps_1.png',
        alt: 'CAN FD transceiver breakout board PCB Version 1 layout with bottom-layer copper',
        caption: 'Initial PCB layout — bottom-layer copper',
        label: 'PCB V1',
        width: 1064,
        height: 1128,
      },
      {
        src: '/images/experience/caps_3.png',
        alt: 'CAN FD transceiver breakout board PCB Version 3 layout with top-layer copper',
        caption: 'Final PCB layout — top-layer copper',
        label: 'PCB V3',
        width: 498,
        height: 792,
      },
    ],
    videos: [
      {
        src: '/videos/experience/lm555 demo.mp4',
        alt: 'LM555 timer demonstration',
        poster: '/images/experience/lm555-demo-poster.jpg',
        caption: 'LM555 timer demonstration',
      },
    ],
  },
  {
    title: 'Event Organiser',
    organization: 'Pickle It Down',
    dates: 'May 2024 – Jan 2026',
    details: [
      'Co-founded a pickleball community that brought together 50+ players for tournaments and social events',
      'Managed venue booking, logistics, catering, and match-fixture planning',
      'Built and grew an Instagram community to promote events and keep players engaged',
      'Organised get-togethers and social sessions so players could meet new people and play together',
      'Motto: “We connect, you play.”',
    ],
    socialLink: {
      label: 'Pickle It Down on Instagram',
      href: 'https://www.instagram.com/_pickleitdown_',
    },
    images: [
      {
        src: '/images/experience/pickle-it-down-tournament.jpeg',
        alt: 'Pickle It Down tournament winners on the court',
        caption: 'Pickle It Down tournament',
        width: 960,
        height: 1280,
      },
    ],
  },
];

export const education: Education[] = [
  {
    institution: 'University of California San Diego',
    degree: 'B.S. Artificial Intelligence',
    expectedGraduation: 'June 2030',
  },
  {
    institution: 'Delhi Public School, Surat',
    degree: 'Central Board of Secondary Education (CBSE)',
    dates: '2011–2026',
    details: [
      'Senior secondary subjects: Mathematics, Physics, Chemistry, English, and Computer Science',
      'Scored 93 in Computer Science and 89 in Mathematics',
      'Captain of the school basketball team (2026)',
      'Dragon House captain (one of four school houses)',
    ],
  },
];

export const awards: Award[] = [
  { name: 'International Computer Science Competition Finalist', detail: '2025', year: '2025' },
  { name: 'Mental Math World Cup', detail: 'Rank 411 / 8600 globally', year: '2025' },
  { name: 'Ramanujan National Math Competition', detail: 'National Rank 373', year: '2024' },
];

export const technicalInterests = [
  'Computer Vision',
  'Vision-Language-Action Models',
  'Consumer Robotics',
  'Custom Motors for Robot Joints',
  'Tesla Full Self-Driving Chips',
  'Reinforcement Learning',
];

export const verifiedSkills = {
  programming: ['Python'],
  engineering: ['Embedded Systems', 'PCB Design', 'Soldering', 'IoT Systems', 'AI-assisted Programming'],
  software: ['Onshape', 'GitHub', 'EasyEDA', 'CST Studio', 'Visual Studio Code', 'Microsoft Excel', 'Microsoft Word', 'Google Sheets'],
};

export const contactLinks: ContactLink[] = [
  { label: 'GitHub', href: 'https://github.com/mmalpani-star' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/madhav-malpani-a79189261/' },
  { label: 'Handshake', href: 'https://ucsd.joinhandshake.com/profiles/tg66pu' },
];

export const secondaryWork: SecondaryWork[] = [
  {
    title: 'Gesture-Controlled Drone',
    details: ['ESP32 board soldering', '3D-printed components', 'CAD work', 'Project was not successfully completed'],
  },
  {
    title: 'ROV',
    details: ['CAD/modeling project', 'Primarily visual/CAD work'],
  },
  {
    title: 'Machine Learning',
    details: [
      'Participated in an IIT Kanpur machine-learning training program',
      'Studied foundational machine learning and linear algebra concepts',
      'Worked on an SVM-based handwritten digit classifier using Python and scikit-learn',
      'Development involved AI-assisted coding',
    ],
  },
  {
    title: 'Pickle It Down',
    details: [
      'Co-founded a pickleball community built around tournaments and social meetups',
      'Organised games for 50+ players and handled venue logistics, catering, and match scheduling',
      'Built engagement through Instagram updates, event promotions, and community communication',
      'Created a welcoming environment where players could meet new people and play together',
      'Motto: “We connect, you play.”',
    ],
  },
];
