# Landing hanger

The home page (`/` with no hash) opens on a rotating four-tag garment rack. Each tag is a link into an
existing section; every section keeps its content and routing untouched.

## How it fits together

| Piece | Where | Job |
| --- | --- | --- |
| Boot script | `app/layout.tsx` | Sets `html[data-hub]` before first paint so `/` never flashes the old page and direct section URLs open straight into content. |
| `HangerHub` | `components/hub/` | Full-screen layer driven **only by the URL** (`/` + no hash = showing). Lazy-loads the scene, owns focus, `inert`, caption, keyboard links. |
| `BackToHanger` | `components/hub/` | A plain `<Link href="/">`, fixed bottom-left, shown whenever the hanger is not. |
| Scene | `lib/three/hanger-rack.ts` | Three.js rack, physics, picking, media textures. No extra dependencies. |
| Media decoder | `lib/hub/animated-image.ts` | Decodes animated GIF / WebP frame by frame (`drawImage` on an animated `<img>` only yields one frame). |
| History store | `lib/hub/store.ts` | Wraps `pushState`/`replaceState` once and broadcasts URL changes; also remembers the rack's rotation. |
| Tag data | `lib/hub/tags.ts` | The four tags: label, one-line blurb (existing section copy), destination, media. |

Because the hanger is derived from the URL, browser back/forward, direct links and Back to Hanger all agree.
The scene is created once and kept (stopped, not disposed) while a section is open, so the rack comes back
exactly where it was. When hidden its render loop is at 0 calls per second.

## Changing things

- Tags / media: edit `lib/hub/tags.ts`. The rack builds exactly one hanger per entry; keep it at four.
- Look and feel constants (ring size, hook, sleeve, camera framing, spin speed, sway) are named at the top of
  `lib/three/hanger-rack.ts`.
- `AUTO` is the idle spin speed; the pendulum values are in `stepRig`.

## Provenance and honesty

- The rack's geometry is **modelled here**, from a 24.9 s screen recording of a physical rack (chrome tube over
  a black tube, cube trolleys, round crook hooks, wire hangers, sleeves, rods with flat brackets).
- Proportions and speeds were **estimated from sampled frames**, not measured. The reference rack has twelve
  hangers; this one has four by design, on a smaller ring so four tags still read as a rack.
- Motion that is not in the reference and was added deliberately: the swivel toward the viewer on
  hover/focus/select, and the camera dolly into a chosen tag.
- The rack carries four hangers: Projects, Experience, About and Skills. Contact is not a hanger; it is reached from the
  closing "Let's build something useful." block in every section, and by `/#contact`.
- Tag pictures are the site owner's own files (`arc-reactor.webp`, `san d hacks.gif`, `luffy.webp`,
  `skils.webp`). `san d hacks.gif` has a single frame, so the Experience tag shows a still photo (whole, with
  `fit: 'contain'`); the other three animate. The tag code still supports a video + poster media kind, currently unused.
