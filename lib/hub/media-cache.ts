/**
 * One download per media file, shared by everything on the hanger.
 *
 * The tag textures decode frames from these bytes, and the full-screen transition shows the very same
 * bytes. Giving the transition its own object URL each time is what makes an animated GIF/WebP start
 * again from its first frame on every selection: the browser treats a new URL as a new image, whereas
 * re-using one URL can leave the animation running on from wherever its shared timeline had got to.
 */

const blobs = new Map<string, Promise<Blob>>();

/** Fetch a file once; later callers share the same promise. Failures are not cached. */
export function getMediaBlob(url: string): Promise<Blob> {
  let pending = blobs.get(url);
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      return response.blob();
    });
    pending.catch(() => blobs.delete(url));
    blobs.set(url, pending);
  }
  return pending;
}

/** Start downloading in the background so a later click never meets a blank screen. */
export function preloadMedia(urls: string[]) {
  urls.forEach((url) => {
    getMediaBlob(url).catch(() => undefined);
  });
}

export type TransitionMedia = {
  /** A fresh object URL: show it in a newly created <img> and the animation starts at frame one. */
  src: string;
  release: () => void;
};

/** Make a never-before-used URL for the file, decoded and ready to paint. */
export async function createTransitionMedia(url: string): Promise<TransitionMedia> {
  const blob = await getMediaBlob(url);
  const src = URL.createObjectURL(blob);
  try {
    const probe = new Image();
    probe.src = src;
    await probe.decode();
  } catch {
    // decode() can reject for formats it cannot pre-decode; the visible <img> will still load it
  }
  return { src, release: () => URL.revokeObjectURL(src) };
}
