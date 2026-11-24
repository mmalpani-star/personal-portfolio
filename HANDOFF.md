# Personal Website — Project Handoff

**Prepared:** November 23, 2026  
**Repository:** `mmalpani-star/personal-portfolio` (`main`)  
**Stack:** Next.js 14 (App Router), React 18, TypeScript, Framer Motion, Three.js

## What this is

A static personal portfolio for Madhav Malpani, focused on robotics, hardware, AI, and selected software projects. It has a dark, editorial visual system with a custom interactive landing experience: the root route opens a rotating, four-tag garment rack that routes visitors to Projects, Experience, About, and Skills.

## Running and checking the site

```sh
npm install
npm run dev
npm run typecheck
npm run build
npm start
```

The project currently passes both `npm run typecheck` and `npm run build`. The build statically generates 14 routes, including all project pages. `npm run lint` is defined as `next lint`; with Next 14 this is usable, but the typecheck and production build are the baseline verification commands used here.

## Routes and main entry points

| Route | Source | Purpose |
| --- | --- | --- |
| `/` | `app/page.tsx` | Home sections: Hero, Experience, Projects, Awards, Contact. With no hash, the hanger hub is shown first. |
| `/#projects`, `/#experience`, `/#contact` | `app/page.tsx`, `components/hub/HangerHub.tsx` | Direct section destinations; the hanger stays closed. |
| `/about` | `app/about/page.tsx` | Personal/about page with arc-reactor and manga-panel content. |
| `/skills` | `app/skills/page.tsx` | Interactive skills/backpack experience. |
| `/projects/[slug]` | `app/projects/[slug]/page.tsx` | Static project case studies built from `displayProjects`. |

`app/layout.tsx` owns global metadata, fonts, global navigation/footer, pointer effects, and the URL-driven hanger boot script. Keep that script aligned with `HangerHub` if changing how home or hash routes behave; it prevents a flash of page content before the hub initializes.

## Content maintenance

The primary content source is `data/site-data.ts`:

- `projects` / `displayProjects`: project pages and project cards.
- `experiences`, `education`, `awards`, `contactLinks`: homepage and supporting content.
- `aboutPanels`, interests, hobbies, and other profile copy: About page content.

`data/experience-story.ts` is a separate, narrative data source for the redesigned Experience section.

The currently published project slugs are:

- `quadruped-leg-kinematics`
- `hexapod`
- `cubesat-antenna-mechanism`
- `air-quality-monitor`
- `tritonspend-ai`
- `borderpulse`
- `hydrosafe`

To add a project, add its data object and media paths in `data/site-data.ts`. `generateStaticParams()` in `app/projects/[slug]/page.tsx` automatically creates its route. Provide accurate width/height metadata for images and a poster for each video where possible.

## Interactive systems

| System | Key files | Notes |
| --- | --- | --- |
| Landing hanger hub | `components/hub/`, `lib/hub/`, `lib/three/hanger-rack.ts` | URL-controlled, keyboard-aware Three.js scene. Read `components/hub/README.md` before modifying it. Keep exactly four tags unless the 3D layout is redesigned. |
| Project model showcases | `components/projects/ModelShowcase.tsx`, `CubesatShowcase.tsx`, `data/models/*.manifest.json` | Loads GLB models from `public/models/`. |
| PCB and hardware viewers | `components/experience/PcbViewer.tsx`, `HardwareViewer.tsx`, `lib/pcb/board-art.ts` | Used in Experience content. |
| About visual sequence | `components/about/` | `app/about/page.tsx` checks that locally referenced `public/` media exists at build time, so missing optional panel media does not create broken requests. |
| Global motion/input effects | `components/animation/`, `components/effects/` | Framer Motion plus pointer/fine-pointer-aware effects. |

## Assets

- Website-served images, video, PDFs, textures, and GLBs live under `public/`.
- The `public/models/*.glb` files are the web exports used by the viewers.
- `cad/` contains reproducible CAD scripts and checked-in lightweight export artifacts for the quadruped, hexapod, air-quality monitor, HydroSafe, and CubeSat.
- `cad/README.md` documents the CAD provenance, assumptions, validations, and rebuild process.
- `cad/sync-web.sh` copies rebuilt model assets/manifests to their website locations.

Large raw CAD inputs remain in the ignored `3d models/` directory. Do not expect a fresh clone to contain them. The ignored `.cadenv/` is the local CAD environment; see `cad/README.md` for its Python/`uv` setup and export commands.

## Deployment and configuration

There are no runtime environment variables or backend/API routes in the repository. `next.config.mjs` enables React strict mode and AVIF/WebP image output. The app is suitable for a normal static-friendly Next.js deployment; the repository itself does not include platform-specific deployment configuration.

## Current repository state / cleanup to decide

The worktree already contains user changes that should be reviewed before committing:

- Modified: `tsconfig.tsbuildinfo` (generated; normally do not commit it).
- Untracked root assets: `caps_1.png`, `caps_2.png`, `caps_3.png`, `lm555.jpg`, `lm555_demo.mp4`, `node-v24.21.0.pkg`.
- Untracked About assets: `public/images/about/san d hacks.jpg`, `public/images/about/skills2.webp`, `public/images/about/starlabs  team.jpeg`, `public/images/about/starlabs-allteams.jpeg`.

`node-v24.21.0.pkg` is an installer and is very likely not a source asset; keep it out of source control unless there is a deliberate archival reason. Determine whether the other untracked files should be connected to the site, moved under `public/`, committed, or ignored. Do not remove them without the owner’s confirmation.

The last visible commits concern the hanger redesign and new hardware/CAD experiences. The current branch is `main`, with `origin` pointing to `https://github.com/mmalpani-star/personal-portfolio.git`.

## Recommended next-owner workflow

1. Review the untracked assets and generated TypeScript build info, then make an intentional commit boundary.
2. When changing content, update `data/site-data.ts` first and add matching optimized files in `public/`.
3. When changing 3D/CAD content, rebuild only the affected model in `cad/`, inspect its validation JSON, then run `cad/sync-web.sh` before testing the site.
4. Run `npm run typecheck` and `npm run build` before deployment.
5. Manually check desktop/mobile interaction for the hanger, model viewer, media lightboxes, the direct hash routes, and reduced-motion behavior after UI changes.

## Useful references

- Hanger implementation notes: `components/hub/README.md`
- CAD build, assumptions, and verification: `cad/README.md`
- Home page composition: `app/page.tsx`
- Shared design tokens/global styles: `app/globals.css`
- Project case-study template: `app/projects/[slug]/page.tsx`
