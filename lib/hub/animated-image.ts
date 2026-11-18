/**
 * Decodes an animated GIF or animated WebP into a list of cropped, downscaled frames.
 *
 * Why this exists: the rack draws each tag's picture into a WebGL texture, and
 * `drawImage(<img>)` on an animated image only ever returns one frame (verified in Chrome),
 * so the frames are decoded by hand and played back as a sequence of textures. Only
 * universally available APIs are used (fetch, canvas, createImageBitmap).
 *
 * - GIF: a small LZW decoder (interlace, transparency, disposal methods 0-3).
 * - WebP: the RIFF container is split into per-frame still WebP files, which the browser
 *   decodes natively, then composited with the frame's blend / dispose flags.
 */

export type DecodedFrames = {
  /** One canvas per frame, already cropped to `outW x outH`. */
  frames: HTMLCanvasElement[];
  /** Display time of each frame, in ms. */
  delays: number[];
  /** Sum of `delays`. */
  duration: number;
};

export type DecodeOptions = {
  outW: number;
  outH: number;
  /** Where the crop sits when the source aspect differs: 0 = start edge, 1 = end edge. */
  focus: [number, number];
  /** Decode only the first frame (reduced motion). */
  firstFrameOnly?: boolean;
  signal?: AbortSignal;
};

type Patch = {
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
  dispose: number;
  /** false = overwrite the rectangle instead of alpha-blending (WebP only). */
  blend: boolean;
  rgba?: Uint8ClampedArray;
  bitmap?: ImageBitmap;
};

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode.apply(null, Array.prototype.slice.call(b, o, o + n));
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/* ------------------------------------------------------------------ GIF */

function lzwDecode(minCodeSize: number, data: Uint8Array, pixelCount: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  const out = new Uint8Array(pixelCount);
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let old = -1;
  let first = 0;
  let bits = 0;
  let nbits = 0;
  let ip = 0;
  let op = 0;

  while (op < pixelCount) {
    while (nbits < codeSize) {
      if (ip >= data.length) return out;
      bits |= data[ip++] << nbits;
      nbits += 8;
    }
    let code = bits & ((1 << codeSize) - 1);
    bits >>= codeSize;
    nbits -= codeSize;

    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      old = -1;
      continue;
    }
    if (code === eoi) break;
    if (old === -1) {
      out[op++] = code;
      old = code;
      first = code;
      continue;
    }
    const inCode = code;
    let sp = 0;
    if (code >= next) {
      stack[sp++] = first;
      code = old;
    }
    while (code >= clear) {
      stack[sp++] = suffix[code];
      code = prefix[code];
    }
    first = code;
    stack[sp++] = first;
    if (next < 4096) {
      prefix[next] = old;
      suffix[next] = first;
      next++;
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
    }
    old = inCode;
    while (sp > 0 && op < pixelCount) out[op++] = stack[--sp];
  }
  return out;
}

function parseGif(buf: Uint8Array, firstOnly: boolean): { width: number; height: number; patches: Patch[] } {
  const u16 = (o: number) => buf[o] | (buf[o + 1] << 8);
  const width = u16(6);
  const height = u16(8);
  const flags = buf[10];
  let p = 13;
  let globalTable: Uint8Array | null = null;
  if (flags & 0x80) {
    const n = 3 << ((flags & 7) + 1);
    globalTable = buf.subarray(p, p + n);
    p += n;
  }

  const patches: Patch[] = [];
  let delay = 100;
  let dispose = 0;
  let transparent = -1;

  const skipBlocks = () => {
    while (p < buf.length && buf[p] !== 0) p += buf[p] + 1;
    p++;
  };

  while (p < buf.length) {
    const block = buf[p++];
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = buf[p++];
      if (label === 0xf9) {
        const packed = buf[p + 1];
        dispose = (packed >> 2) & 7;
        delay = u16(p + 2) * 10;
        if (delay < 20) delay = 100; // browsers treat tiny delays as 100 ms
        transparent = packed & 1 ? buf[p + 4] : -1;
      }
      skipBlocks();
    } else if (block === 0x2c) {
      const x = u16(p);
      const y = u16(p + 2);
      const w = u16(p + 4);
      const h = u16(p + 6);
      const packed = buf[p + 8];
      p += 9;
      let table = globalTable;
      if (packed & 0x80) {
        const n = 3 << ((packed & 7) + 1);
        table = buf.subarray(p, p + n);
        p += n;
      }
      const minCode = buf[p++];
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (p < buf.length && buf[p] !== 0) {
        const len = buf[p];
        chunks.push(buf.subarray(p + 1, p + 1 + len));
        total += len;
        p += len + 1;
      }
      p++;
      const data = new Uint8Array(total);
      let at = 0;
      chunks.forEach((c) => {
        data.set(c, at);
        at += c.length;
      });

      const indices = lzwDecode(minCode, data, w * h);
      const rgba = new Uint8ClampedArray(w * h * 4);
      const interlaced = (packed & 0x40) !== 0;
      // Interlaced rows arrive in four passes; map the n-th decoded row to its real row.
      const rowFor = (n: number) => {
        if (!interlaced) return n;
        const pass1 = Math.ceil(h / 8);
        const pass2 = Math.ceil((h - 4) / 8);
        const pass3 = Math.ceil((h - 2) / 4);
        if (n < pass1) return n * 8;
        if (n < pass1 + pass2) return (n - pass1) * 8 + 4;
        if (n < pass1 + pass2 + pass3) return (n - pass1 - pass2) * 4 + 2;
        return (n - pass1 - pass2 - pass3) * 2 + 1;
      };
      for (let n = 0; n < h; n++) {
        const row = rowFor(n);
        for (let col = 0; col < w; col++) {
          const idx = indices[n * w + col];
          const o = (row * w + col) * 4;
          if (idx === transparent || !table) {
            rgba[o + 3] = 0;
          } else {
            rgba[o] = table[idx * 3];
            rgba[o + 1] = table[idx * 3 + 1];
            rgba[o + 2] = table[idx * 3 + 2];
            rgba[o + 3] = 255;
          }
        }
      }
      patches.push({ x, y, w, h, delay, dispose, blend: true, rgba });
      // Graphic control extensions apply to one image only.
      delay = 100;
      dispose = 0;
      transparent = -1;
      if (firstOnly) break;
    } else {
      // unknown block: stop rather than loop forever
      break;
    }
  }
  return { width, height, patches };
}

/* ----------------------------------------------------------------- WebP */

async function parseWebp(
  buf: Uint8Array,
  firstOnly: boolean,
): Promise<{ width: number; height: number; patches: Patch[] }> {
  const u24 = (o: number) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
  const u32 = (o: number) => (buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) >>> 0;

  let width = 0;
  let height = 0;
  let animated = false;
  const raw: { x: number; y: number; w: number; h: number; delay: number; dispose: number; blend: boolean; chunks: Uint8Array }[] = [];

  let o = 12;
  while (o + 8 <= buf.length) {
    const tag = ascii(buf, o, 4);
    const size = u32(o + 4);
    if (tag === 'VP8X') {
      animated = (buf[o + 8] & 2) !== 0;
      width = 1 + u24(o + 12);
      height = 1 + u24(o + 15);
    } else if (tag === 'ANMF') {
      const flags = buf[o + 23];
      raw.push({
        x: 2 * u24(o + 8),
        y: 2 * u24(o + 11),
        w: 1 + u24(o + 14),
        h: 1 + u24(o + 17),
        delay: Math.max(20, u24(o + 20)) || 100,
        dispose: flags & 1,
        blend: (flags & 2) === 0,
        chunks: buf.subarray(o + 24, o + 8 + size),
      });
    }
    o += 8 + size + (size & 1);
  }

  const wrap = (chunks: Uint8Array, w: number, h: number): Blob => {
    const hasAlpha = chunks.length > 4 && (ascii(chunks, 0, 4) === 'ALPH' || ascii(chunks, 0, 4) === 'VP8L');
    const vp8x = new Uint8Array(18);
    vp8x.set([0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, hasAlpha ? 0x10 : 0, 0, 0, 0]);
    const ww = w - 1;
    const hh = h - 1;
    vp8x.set([ww & 255, (ww >> 8) & 255, (ww >> 16) & 255, hh & 255, (hh >> 8) & 255, (hh >> 16) & 255], 12);
    const payload = 4 + vp8x.length + chunks.length;
    const head = new Uint8Array(12);
    head.set([0x52, 0x49, 0x46, 0x46, payload & 255, (payload >> 8) & 255, (payload >> 16) & 255, (payload >> 24) & 255, 0x57, 0x45, 0x42, 0x50]);
    return new Blob([head, vp8x, chunks], { type: 'image/webp' });
  };

  if (!animated || raw.length === 0) {
    const bitmap = await createImageBitmap(new Blob([buf], { type: 'image/webp' }));
    return { width: bitmap.width, height: bitmap.height, patches: [{ x: 0, y: 0, w: bitmap.width, h: bitmap.height, delay: 1000, dispose: 0, blend: false, bitmap }] };
  }

  const patches: Patch[] = [];
  for (let i = 0; i < raw.length; i++) {
    const f = raw[i];
    const bitmap = await createImageBitmap(wrap(f.chunks, f.w, f.h));
    patches.push({ x: f.x, y: f.y, w: f.w, h: f.h, delay: f.delay, dispose: f.dispose, blend: f.blend, bitmap });
    if (firstOnly) break;
  }
  return { width, height, patches };
}

/* ------------------------------------------------------------ composite */

export async function decodeAnimated(url: string, options: DecodeOptions): Promise<DecodedFrames> {
  const res = await fetch(url, { signal: options.signal });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const firstOnly = !!options.firstFrameOnly;

  const isGif = ascii(buf, 0, 3) === 'GIF';
  const isWebp = ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP';
  if (!isGif && !isWebp) throw new Error(`${url} is not a GIF or WebP`);
  const { width, height, patches } = isGif ? parseGif(buf, firstOnly) : await parseWebp(buf, firstOnly);
  if (!patches.length || !width || !height) throw new Error(`${url} has no frames`);

  const work = document.createElement('canvas');
  work.width = width;
  work.height = height;
  const wctx = work.getContext('2d', { willReadFrequently: false })!;
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d')!;
  const snapshot = document.createElement('canvas');
  snapshot.width = width;
  snapshot.height = height;
  const snapCtx = snapshot.getContext('2d')!;

  // Cover-crop box inside the source.
  const aspect = options.outW / options.outH;
  let sw = width;
  let sh = width / aspect;
  if (sh > height) {
    sh = height;
    sw = height * aspect;
  }
  const sx = (width - sw) * options.focus[0];
  const sy = (height - sh) * options.focus[1];

  const frames: HTMLCanvasElement[] = [];
  const delays: number[] = [];
  let previous: Patch | null = null;

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    // Undo the previous frame as its disposal method asks.
    if (previous) {
      if (previous.dispose === 2 || (previous.bitmap && previous.dispose === 1)) wctx.clearRect(previous.x, previous.y, previous.w, previous.h);
      else if (previous.dispose === 3) {
        wctx.clearRect(0, 0, width, height);
        wctx.drawImage(snapshot, 0, 0);
      }
    }
    if (patch.dispose === 3) {
      snapCtx.clearRect(0, 0, width, height);
      snapCtx.drawImage(work, 0, 0);
    }
    if (patch.rgba) {
      scratch.width = patch.w;
      scratch.height = patch.h;
      sctx.putImageData(new ImageData(patch.rgba, patch.w, patch.h), 0, 0);
      wctx.drawImage(scratch, patch.x, patch.y);
    } else if (patch.bitmap) {
      if (!patch.blend) wctx.clearRect(patch.x, patch.y, patch.w, patch.h);
      wctx.drawImage(patch.bitmap, patch.x, patch.y);
      patch.bitmap.close();
      patch.bitmap = undefined;
    }

    const out = document.createElement('canvas');
    out.width = options.outW;
    out.height = options.outH;
    const octx = out.getContext('2d')!;
    octx.fillStyle = '#0d0d0d';
    octx.fillRect(0, 0, out.width, out.height);
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(work, sx, sy, sw, sh, 0, 0, out.width, out.height);
    frames.push(out);
    delays.push(patch.delay);

    patch.rgba = undefined;
    previous = patch;
    if (i % 4 === 3) await yieldToBrowser();
  }

  return { frames, delays, duration: delays.reduce((a, b) => a + b, 0) };
}
