/**
 * The marks shown for each skill. NO official brand artwork is bundled: these are simplified marks drawn
 * for this site, in the brand's colours where the brand has them. Swap any entry's `svg` for an official
 * file whenever one is to hand; nothing else depends on the drawing.
 *
 * Markup uses three CSS variables so one drawing serves both states:
 *   --c1 / --c2  main and accent colour (greyscale at rest, the brand's colours on hover)
 *   --ko         the colour of knocked-out details (the stage colour at rest, white on hover)
 */

export type SkillGroupId = 'programming' | 'engineering' | 'software';

export type SkillLogo = {
  /** Must match an entry of `verifiedSkills` in data/site-data.ts. */
  label: string;
  group: SkillGroupId;
  /** Brand colours (or, for concepts with no brand, a chosen accent). */
  c1: string;
  c2?: string;
  /** True when the drawing is an original icon for a concept rather than a company's mark. */
  concept?: boolean;
  svg: string;
};

const S = 'fill="none" stroke="var(--c1)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

export const SKILL_LOGOS: SkillLogo[] = [
  /* ------------------------------- Programming ------------------------------- */
  {
    label: 'Python',
    group: 'programming',
    c1: '#3776AB',
    c2: '#FFD43B',
    svg: `<path fill="var(--c1)" fill-rule="evenodd" d="M11.9 2C8 2 8 3.7 8 3.7V6h4.1v.8H6.3S3 6.4 3 11.4s2.9 4.8 2.9 4.8h1.7v-2.3s-.1-2.8 2.8-2.8h4.5s2.7 0 2.7-2.6V4.7S17.9 2 11.9 2Zm-2.3 1.4a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"/><path transform="rotate(180 12 12)" fill="var(--c2)" fill-rule="evenodd" d="M11.9 2C8 2 8 3.7 8 3.7V6h4.1v.8H6.3S3 6.4 3 11.4s2.9 4.8 2.9 4.8h1.7v-2.3s-.1-2.8 2.8-2.8h4.5s2.7 0 2.7-2.6V4.7S17.9 2 11.9 2Zm-2.3 1.4a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"/>`,
  },
  {
    label: 'Java',
    group: 'programming',
    c1: '#5382A1',
    c2: '#E76F00',
    svg: `<path fill="var(--c1)" d="M5.3 13.6h11.4s.7 4.5-2.7 5.7H8c-3.4-1.2-2.7-5.7-2.7-5.7Z"/><path ${S.replace('var(--c1)', 'var(--c1)')} d="M16.7 14.8h1c1.9 0 2.1 2.6-.2 3.1l-1.9.4"/><path ${S.replace('var(--c1)', 'var(--c1)')} d="M4 21.2h13.6"/><path fill="none" stroke="var(--c2)" stroke-width="1.7" stroke-linecap="round" d="M9.6 11.4c2.4-2.1.2-3.2 1.8-5.4M13.2 11.4c2-1.7-.1-2.7 1.1-4.4"/>`,
  },
  {
    label: 'TypeScript',
    group: 'programming',
    c1: '#3178C6',
    svg: `<rect x="2.5" y="2.5" width="19" height="19" rx="2.6" fill="var(--c1)"/><path fill="var(--ko)" d="M6.6 11.3h5.3v1.3H10v5.6H8.5v-5.6H6.6v-1.3Z"/><path fill="none" stroke="var(--ko)" stroke-width="1.4" stroke-linecap="round" d="M17.8 11.9c-.4-.3-.9-.5-1.5-.5-.9 0-1.5.5-1.5 1.2 0 1.7 3.2 1 3.2 3.1 0 .9-.8 1.6-1.9 1.6-.7 0-1.3-.2-1.8-.7"/>`,
  },
  {
    label: 'C/C++',
    group: 'programming',
    c1: '#00599C',
    c2: '#659AD2',
    svg: `<path fill="var(--c1)" d="M12 2 20.8 7v10L12 22 3.2 17V7L12 2Z"/><path fill="none" stroke="var(--ko)" stroke-width="1.8" stroke-linecap="round" d="M11.1 9.3a3.4 3.4 0 1 0 0 5.4"/><path fill="none" stroke="var(--ko)" stroke-width="1.3" stroke-linecap="round" d="M14.4 12h2.6M15.7 10.7v2.6M18.1 12h0"/>`,
  },
  {
    label: 'MySQL',
    group: 'programming',
    c1: '#4479A1',
    c2: '#F29111',
    svg: `<path fill="var(--c1)" d="M3 16.4c.6-5.8 4.6-9.4 9.7-9 1.9.2 3.2.9 4.2 2l3.3-1.1-1.3 2.7c-.7 2.7-2.8 4.3-5.6 4.1-1.6-.1-2.5-.8-3.7-.6-1.7.3-2.6 2.2-4 3-1.2.7-2.7.5-3.9-.4l1.3-.7Z"/><path fill="var(--c2)" d="M7.3 18.6c1.6-.8 3.1-.5 4.5.2 1.5.8 3.3.9 4.6-.1-.6 1.8-2.4 2.9-4.5 2.9-2.3 0-4.1-1-4.6-3Z"/><circle cx="16.2" cy="9.9" r=".9" fill="var(--ko)"/>`,
  },

  /* ------------------------------- Engineering ------------------------------- */
  {
    label: 'Embedded Systems',
    group: 'engineering',
    c1: '#2DD4BF',
    concept: true,
    svg: `<rect x="7" y="7" width="10" height="10" rx="1.6" ${S}/><rect x="10.2" y="10.2" width="3.6" height="3.6" rx=".6" fill="var(--c1)"/><path ${S} d="M9.5 3.5V7M14.5 3.5V7M9.5 17v3.5M14.5 17v3.5M3.5 9.5H7M3.5 14.5H7M17 9.5h3.5M17 14.5h3.5"/>`,
  },
  {
    label: 'PCB Design',
    group: 'engineering',
    c1: '#4ADE80',
    concept: true,
    svg: `<rect x="3" y="4" width="18" height="16" rx="2.2" ${S}/><path ${S} d="M6.5 8.5h5l1.8 1.8h4M6.5 12.5h3l1.8 1.8H17.5M6.5 16.5h6.5"/><circle cx="17.5" cy="10.3" r="1" fill="var(--c1)"/><circle cx="17.5" cy="14.3" r="1" fill="var(--c1)"/><circle cx="13" cy="16.5" r="1" fill="var(--c1)"/>`,
  },
  {
    label: 'CAD',
    group: 'engineering',
    c1: '#FB923C',
    concept: true,
    svg: `<path ${S} d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4l8-4.6ZM12 12 20 7.4M12 12 4 7.4M12 12v9.2"/>`,
  },
  {
    label: 'Soldering',
    group: 'engineering',
    c1: '#F87171',
    concept: true,
    svg: `<path ${S} d="M20.2 3.8 15.4 8.6M16.6 4.4l3 3"/><path fill="var(--c1)" d="m14.2 7.8 2.4 2.4-4.4 4.4-2.4-2.4 4.4-4.4Z"/><path ${S} d="m10.2 14.6-5.6 5.6"/><circle cx="4.4" cy="20.2" r="1.3" fill="var(--c1)"/><path ${S} d="M16.8 16.2l1.4 1.4M19.6 13.4l1.3.4M13.6 19.4l.4 1.6"/>`,
  },
  {
    label: 'IoT Systems',
    group: 'engineering',
    c1: '#38BDF8',
    concept: true,
    svg: `<circle cx="12" cy="13.2" r="2.1" fill="var(--c1)"/><path ${S} d="M7.9 9.1a5.8 5.8 0 0 1 8.2 0M5.2 6.4a9.6 9.6 0 0 1 13.6 0"/><circle cx="5" cy="19" r="1.8" ${S}/><circle cx="19" cy="19" r="1.8" ${S}/><path ${S} d="M6.7 17.8 10.4 14.8M17.3 17.8l-3.7-3"/>`,
  },
  {
    label: 'Vibe Coding',
    group: 'engineering',
    c1: '#C084FC',
    concept: true,
    svg: `<path ${S} d="M8 7.5 3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5"/><path fill="var(--c1)" d="m12 6.8.9 3.1 3.1.9-3.1.9-.9 3.1-.9-3.1-3.1-.9 3.1-.9.9-3.1Z"/>`,
  },

  /* ----------------------------- Software & tools ---------------------------- */
  {
    label: 'Onshape',
    group: 'software',
    c1: '#4FA43D',
    svg: `<path fill="var(--c1)" fill-rule="evenodd" d="M12 2.4 20.4 7.2v9.6L12 21.6 3.6 16.8V7.2L12 2.4Zm0 5.2-3.9 2.3v4.2l3.9 2.3 3.9-2.3V9.9L12 7.6Z"/>`,
  },
  {
    label: 'GitHub',
    group: 'software',
    c1: '#FFFFFF',
    svg: `<path ${S} stroke-width="1.6" d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>`,
  },
  {
    label: 'EasyEDA',
    group: 'software',
    c1: '#1E90FF',
    svg: `<rect x="2.8" y="2.8" width="18.4" height="18.4" rx="3.2" fill="var(--c1)"/><path fill="none" stroke="var(--ko)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M16.4 7.4H9.6v9.2h6.8M9.6 12h5"/>`,
  },
  {
    label: 'CST Studio',
    group: 'software',
    c1: '#E8542B',
    svg: `<path fill="none" stroke="var(--c1)" stroke-width="1.7" stroke-linecap="round" d="M20.2 12a8.2 8.2 0 1 0-8.2 8.2"/><path fill="none" stroke="var(--c1)" stroke-width="1.7" stroke-linecap="round" d="M16.4 12a4.4 4.4 0 1 0-4.4 4.4"/><circle cx="12" cy="12" r="1.5" fill="var(--c1)"/><path fill="none" stroke="var(--c1)" stroke-width="1.7" stroke-linecap="round" d="m15.4 15.4 4.6 4.6"/>`,
  },
  {
    label: 'Claude Code',
    group: 'software',
    c1: '#D97757',
    svg: `<g stroke="var(--c1)" stroke-width="2.1" stroke-linecap="round"><path d="M12 2.6v5.2"/><path d="M12 16.2v5.2"/><path d="M2.6 12h5.2"/><path d="M16.2 12h5.2"/><path d="M5.4 5.4l3.5 3.5"/><path d="m15.1 15.1 3.5 3.5"/><path d="M18.6 5.4l-3.5 3.5"/><path d="M8.9 15.1l-3.5 3.5"/><path d="M8.2 3.5l1.9 4.5" /><path d="m13.9 16 1.9 4.5"/><path d="m15.8 3.5-1.9 4.5"/><path d="m10.1 16-1.9 4.5"/></g>`,
  },
  {
    label: 'Codex',
    group: 'software',
    c1: '#FFFFFF',
    svg: `<g fill="none" stroke="var(--c1)" stroke-width="1.5"><rect x="7.4" y="2.6" width="9.2" height="18.8" rx="4.6"/><rect x="7.4" y="2.6" width="9.2" height="18.8" rx="4.6" transform="rotate(60 12 12)"/><rect x="7.4" y="2.6" width="9.2" height="18.8" rx="4.6" transform="rotate(120 12 12)"/></g>`,
  },
];
