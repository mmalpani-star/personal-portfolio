/**
 * Surface finish for the CAN FD breakout board (`OBJ_PCB_caps_4`).
 *
 * EasyEDA's OBJ export carries geometry only: the board's top and bottom faces are bare, with no solder mask, silkscreen,
 * pads or vias (those are 2-D layers that EasyEDA paints on in its own 3D view). This module paints them back on as a
 * texture, so the 3D model reads as the finished board it is. Nothing here changes the geometry or the circuit.
 *
 * Where each piece comes from (so it can be checked):
 *  - Component positions and sizes: measured from the OBJ itself (bounding boxes of each part, in the model's own
 *    units; the 5-pin header body is 50 units wide, so one unit is 0.254 mm, i.e. 10 mil).
 *  - Silkscreen text (CAN_H, CAN_L, madhu, D1, R11_60.4, R1_60.4, C11_4.7NF, R3_10K, C4_100NF, C1_100NF, C5_100NF, U1,
 *    TXD, GND, 5V, RXD, 3.3V): read from the owner's EasyEDA 3D-view screenshots of this same board. Positions were
 *    recovered by mapping those screenshots onto the OBJ's component positions, so they are close, not pixel-exact; the
 *    typeface is the browser's own bold sans, not EasyEDA's stroke font.
 *  - Via positions: detected in the same screenshots (the stitching ring round the edge and four inner vias).
 *  - Bottom-layer artwork: the owner's own artwork, rectified from the EasyEDA back-view screenshot into
 *    `/models/pcb/pcb-back-art.png`; the OBJ has no copy of it.
 *  - Pads and part outlines are drawn from the parts' footprints with typical proportions; the copper traces under the
 *    mask are NOT reproduced.
 */

/** Board extent in model units (X 0..W, Y 0..H, measured from the OBJ's bounding box). */
export const BOARD = { w: 66, h: 125.8, top: 10, bottom: 0 } as const;

/** Texture pixels per model unit. */
export const TEX_SCALE = 22;

const MASK = '#0b2f93';
const SILK = '#ffffff';
const GOLD = '#dcb449';
const GOLD_DARK = '#a8842a';

type Box = { x0: number; x1: number; y0: number; y1: number };

/** Two-terminal chip parts (0805-style), from the OBJ's component bounding boxes. */
const CHIPS: Box[] = [
  { x0: 17.9, x1: 24.3, y0: 81.3, y1: 84.5 }, // R11
  { x0: 38.9, x1: 45.3, y0: 81.3, y1: 84.5 }, // R1
  { x0: 30.0, x1: 33.2, y0: 71.3, y1: 77.5 }, // C11
  { x0: 10.5, x1: 15.7, y0: 66.0, y1: 73.8 }, // R3
  { x0: 48.2, x1: 56.0, y0: 67.1, y1: 72.3 }, // C4
  { x0: 48.0, x1: 53.2, y0: 48.0, y1: 55.8 }, // C1
  { x0: 27.7, x1: 35.5, y0: 28.8, y1: 34.0 }, // C5
];

/** Four-per-side SOIC-8 (U1): lead centres at ±2.5 and ±7.5 around the body centre (1.27 mm pitch). */
const U1 = { cx: 31.65, bodyY0: 45.2, bodyY1: 60.6 };

/** The five header pins: 2.54 mm pitch. */
const PIN_X = [13.5, 23.5, 33.5, 43.5, 53.5];
const PIN_Y = 14.9;

/** Via positions, in model units. The ring is regular; the four inner vias were found in the screenshots. */
const VIA_LEFT_X = 3.1;
const VIA_RIGHT_X = 62.75;
const VIA_COLUMN_Y = [117.7, 110.9, 104.0, 97.0, 89.5, 81.2, 74.8, 68.0, 60.5, 52.8, 44.0, 36.7, 29.0, 22.0, 14.4];
const VIAS: [number, number][] = [
  ...VIA_COLUMN_Y.map((y): [number, number] => [VIA_LEFT_X, y]),
  ...VIA_COLUMN_Y.map((y): [number, number] => [VIA_RIGHT_X, y + 0.3]),
  // top row
  [7.6, 122.9], [15.0, 122.9], [22.0, 122.9], [40.8, 122.9], [48.8, 122.9], [56.7, 122.9],
  // bottom row
  [4.1, 4.2], [10.6, 3.7], [20.0, 3.7], [27.5, 3.2], [37.5, 3.2], [45.9, 3.2], [53.9, 3.2], [60.8, 4.2],
  // inner vias
  [31.4, 84.8], [26.5, 74.8], [44.4, 55.9], [29.0, 49.3],
];

type Label = {
  text: string;
  x: number;
  y: number;
  /** Degrees, counter-clockwise as seen on the board (0 reads left to right). */
  rot: number;
  /** Width the text should span, in model units. */
  width: number;
  /** Capital height in model units. */
  cap?: number;
  weight?: number;
  family?: string;
};

const LABELS: Label[] = [
  { text: 'CAN_H', x: 21.6, y: 123.2, rot: 0, width: 9.7 },
  { text: 'CAN_L', x: 41.0, y: 123.2, rot: 0, width: 9.7 },
  { text: 'madhu', x: 8.2, y: 103.8, rot: 90, width: 31, cap: 6.2, weight: 400 },
  { text: 'D1', x: 22.6, y: 91.5, rot: 90, width: 3.2, cap: 2.6 },
  { text: 'R11_60.4', x: 13.6, y: 87.3, rot: 90, width: 9.9, cap: 2.6 },
  { text: 'R1_60.4', x: 49.6, y: 85.6, rot: 90, width: 8.6, cap: 2.6 },
  { text: 'C11_4.7NF', x: 26.2, y: 75.5, rot: -90, width: 8.2, cap: 1.9 },
  { text: 'R3_10K', x: 6.6, y: 69.4, rot: 90, width: 8.6, cap: 2.6 },
  { text: 'C4_100NF', x: 52.8, y: 75.8, rot: 180, width: 13.4, cap: 2.6 },
  { text: 'U1', x: 43.3, y: 52.8, rot: -90, width: 3.2, cap: 2.4 },
  { text: 'C1_100NF', x: 57.2, y: 52.8, rot: -90, width: 11.4, cap: 2.6 },
  { text: 'C5_100NF', x: 34.7, y: 25.7, rot: 0, width: 13.4, cap: 2.6 },
  { text: 'TXD', x: PIN_X[0], y: 5.6, rot: 90, width: 6.0, cap: 2.8 },
  { text: 'GND', x: PIN_X[1], y: 5.6, rot: 90, width: 6.4, cap: 2.8 },
  { text: '5V', x: PIN_X[2], y: 5.6, rot: 90, width: 4.4, cap: 2.8 },
  { text: 'RXD', x: PIN_X[3], y: 5.6, rot: 90, width: 6.5, cap: 2.8 },
  { text: '3.3V', x: PIN_X[4], y: 5.6, rot: 90, width: 7.2, cap: 2.8 },
];

/** The silkscreen reference designators, for tests and documentation. */
export const SILK_LABELS = LABELS.map((l) => l.text);

type Ctx = CanvasRenderingContext2D;

/** Board space (Y up) onto the canvas (Y down). */
const px = (v: number) => v * TEX_SCALE;
const py = (v: number) => (BOARD.h - v) * TEX_SCALE;

function pad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, r = 0.35) {
  ctx.beginPath();
  const w = px(x1 - x0);
  const h = px(y0 - y1) * -1;
  const rr = Math.min(px(r), Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.roundRect(px(x0), py(y1), w, Math.abs(h), rr);
  ctx.fillStyle = GOLD;
  ctx.fill();
}

function line(ctx: Ctx, ax: number, ay: number, bx: number, by: number, w = 0.7) {
  ctx.beginPath();
  ctx.moveTo(px(ax), py(ay));
  ctx.lineTo(px(bx), py(by));
  ctx.lineWidth = px(w);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = SILK;
  ctx.stroke();
}

function rectOutline(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w = 0.7) {
  line(ctx, x0 - w / 2, y0, x1 + w / 2, y0, w);
  line(ctx, x0 - w / 2, y1, x1 + w / 2, y1, w);
  line(ctx, x0, y0, x0, y1, w);
  line(ctx, x1, y0, x1, y1, w);
}

function drawChip(ctx: Ctx, b: Box) {
  const horizontal = b.x1 - b.x0 > b.y1 - b.y0;
  const ext = 1.1;
  if (horizontal) {
    const len = b.x1 - b.x0;
    const pl = len * 0.4;
    const hh = b.y1 - b.y0 + 1;
    const cy = (b.y0 + b.y1) / 2;
    pad(ctx, b.x0 - ext, cy - hh / 2, b.x0 + pl, cy + hh / 2);
    pad(ctx, b.x1 - pl, cy - hh / 2, b.x1 + ext, cy + hh / 2);
    rectOutline(ctx, b.x0 - ext - 0.9, cy - hh / 2 - 0.9, b.x1 + ext + 0.9, cy + hh / 2 + 0.9);
  } else {
    const len = b.y1 - b.y0;
    const pl = len * 0.4;
    const ww = b.x1 - b.x0 + 1;
    const cx = (b.x0 + b.x1) / 2;
    pad(ctx, cx - ww / 2, b.y0 - ext, cx + ww / 2, b.y0 + pl);
    pad(ctx, cx - ww / 2, b.y1 - pl, cx + ww / 2, b.y1 + ext);
    rectOutline(ctx, cx - ww / 2 - 0.9, b.y0 - ext - 0.9, cx + ww / 2 + 0.9, b.y1 + ext + 0.9);
  }
}

function drawLabel(ctx: Ctx, l: Label) {
  const cap = l.cap ?? 3.1;
  const size = cap / 0.72; // cap height of a typical sans is ~72% of the em
  const family = l.family ?? '"Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.save();
  ctx.translate(px(l.x), py(l.y));
  ctx.rotate((-l.rot * Math.PI) / 180);
  ctx.font = `${l.weight ?? 700} ${px(size)}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = SILK;
  const measured = ctx.measureText(l.text).width || 1;
  const sx = Math.max(0.6, Math.min(1.5, px(l.width) / measured));
  ctx.scale(sx, 1);
  ctx.fillText(l.text, 0, px(cap * 0.04));
  ctx.restore();
}

function drawVias(ctx: Ctx) {
  for (const [x, y] of VIAS) {
    ctx.beginPath();
    ctx.arc(px(x), py(y), px(0.95), 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px(x), py(y), px(0.38), 0, Math.PI * 2);
    ctx.fillStyle = GOLD_DARK;
    ctx.fill();
  }
}

function drawMask(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = MASK;
  ctx.fillRect(0, 0, w, h);
  // A faint sheen so the mask reads as lacquer, not flat paint.
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgba(255,255,255,0.05)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function newCanvas() {
  const c = document.createElement('canvas');
  c.width = Math.round(BOARD.w * TEX_SCALE);
  c.height = Math.round(BOARD.h * TEX_SCALE);
  return c;
}

/** The component side: mask, pads, part outlines, vias and every silkscreen label. */
export function drawTopTexture(): HTMLCanvasElement {
  const c = newCanvas();
  const ctx = c.getContext('2d')!;
  drawMask(ctx, c.width, c.height);

  // JST CAN connector: its two contact pads run past the body to the board's top edge.
  pad(ctx, 27.5, 117.0, 30.5, 123.3, 0.5);
  pad(ctx, 32.4, 117.0, 35.4, 123.3, 0.5);

  // D1 (SOT-323): one pad on top, two below; corner brackets for the outline.
  pad(ctx, 30.4, 94.8, 32.8, 98.5, 0.4);
  pad(ctx, 27.9, 87.3, 30.3, 89.5, 0.4);
  pad(ctx, 33.1, 87.3, 35.5, 89.5, 0.4);
  const d = { x0: 26.8, x1: 36.4, y0: 89.7, y1: 96.0, a: 2.2 };
  for (const [cx, cy, sx, sy] of [[d.x0, d.y0, 1, 1], [d.x1, d.y0, -1, 1], [d.x0, d.y1, 1, -1], [d.x1, d.y1, -1, -1]] as const) {
    line(ctx, cx, cy, cx + sx * d.a, cy);
    line(ctx, cx, cy, cx, cy + sy * d.a);
  }

  CHIPS.forEach((b) => drawChip(ctx, b));

  // U1: eight pads, a short outline on each flank.
  [-7.5, -2.5, 2.5, 7.5].forEach((o) => {
    pad(ctx, U1.cx + o - 1.4, 39.9, U1.cx + o + 1.4, 46.6, 0.5);
    pad(ctx, U1.cx + o - 1.4, 59.2, U1.cx + o + 1.4, 65.9, 0.5);
  });
  line(ctx, U1.cx - 10.9, 49.5, U1.cx - 10.9, 57.0);
  line(ctx, U1.cx + 10.9, 49.5, U1.cx + 10.9, 57.0);

  // 5-pin header: its outline shows above the black body.
  rectOutline(ctx, 7.6, 9.0, 59.6, 20.9, 0.8);

  drawVias(ctx);
  LABELS.forEach((l) => drawLabel(ctx, l));
  return c;
}

/** The back: mask, the owner's bottom-layer artwork, the header's through-hole pads, vias. */
export function drawBottomTexture(art: CanvasImageSource | null): HTMLCanvasElement {
  const c = newCanvas();
  const ctx = c.getContext('2d')!;
  drawMask(ctx, c.width, c.height);
  if (art) ctx.drawImage(art, 0, 0, c.width, c.height);

  // Clear the mask round each header pin, then its gold ring and drill.
  PIN_X.forEach((x) => {
    ctx.beginPath();
    ctx.arc(px(x), py(PIN_Y), px(3.6), 0, Math.PI * 2);
    ctx.fillStyle = MASK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px(x), py(PIN_Y), px(2.3), 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px(x), py(PIN_Y), px(1.0), 0, Math.PI * 2);
    ctx.fillStyle = GOLD_DARK;
    ctx.fill();
  });
  drawVias(ctx);
  return c;
}
