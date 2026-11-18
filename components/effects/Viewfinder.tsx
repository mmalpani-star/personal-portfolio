/**
 * Camera-viewfinder overlay for an image. Put it inside a positioned media box
 * and add the `vf-host` class to the element whose hover should trigger it
 * (the box itself, or a parent card). Pure CSS: brackets, a blinking REC dot,
 * a focus pull on the image and a shutter blink. Touch devices get static brackets.
 * Pass `brackets={false}` where another frame (e.g. WireframeArmor) already marks the corners.
 */
export function Viewfinder({ brackets = true }: { brackets?: boolean }) {
  return (
    <span className="vf" aria-hidden="true">
      <span className="vf-shutter" />
      {brackets ? <span className="vf-brackets" /> : null}
      <span className="vf-reticle" />
      <span className="vf-rec">
        <i />
        REC
      </span>
    </span>
  );
}
