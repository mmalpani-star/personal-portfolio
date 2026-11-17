# About-page panel media

Drop files here with these exact names. Anything missing is simply not shown —
the panel falls back to halftone and type, so nothing breaks while you gather them.

| Panel      | Put the file at                      | Notes                                   |
| ---------- | ------------------------------------ | --------------------------------------- |
| Naruto     | `public/images/about/naruto-sasuke.gif` (+ `naruto-sasuke-still.jpg`) | Animated GIF; the still is its first frame, shown under reduced motion |
| One Piece  | `public/images/about/one-piece.webp`  | Your own photo                          |
| Film       | `public/images/about/dhurandhar.webp` and `yjhd.webp` | Two portrait posters pinned at the top; each shows only if its file exists |
| Gaming     | `public/images/about/gaming.jpg`     | Screenshot from your own match          |
| Basketball | `public/videos/about/basketball.mp4` | Your clip. MP4 is far smaller than GIF  |
| Football   | `public/videos/about/football.mp4`   | Your clip                               |

Landscape crops best — the frames are wide. Every photo is rendered greyscale
with raised contrast so it sits in the ink-on-paper page.

Clips autoplay muted on loop, pause when scrolled out of view, and do not play
at all under `prefers-reduced-motion`.

## One Piece panel options

In `aboutPanels` (data/site-data.ts) the One Piece media carries two switches:

- `fit: 'cover'` fills the frame and crops the edges; `'contain'` shows the whole
  image at its own aspect ratio on paper. Neither ever stretches the picture.
- `halftone: true` lays a printed dot screen over the image.
