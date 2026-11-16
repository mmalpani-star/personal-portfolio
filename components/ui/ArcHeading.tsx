type ArcHeadingProps = {
  /** Two-digit arc number, or a word such as "Next" for the closing section. */
  arc: string;
  title: string;
  /** Id for the h2, referenced by the section's aria-labelledby. */
  id: string;
  description?: string;
};

/** Section header in "arc" form: a mono tag (ARC 01) over the arc's name. */
export function ArcHeading({ arc, title, id, description }: ArcHeadingProps) {
  const tag = /^\d+$/.test(arc) ? `Arc ${arc}` : arc;
  return (
    <div className={`section-heading ${description ? 'section-heading--split' : ''}`.trim()}>
      <div>
        <div className="arc-tag">{tag}</div>
        <h2 id={id}>{title}</h2>
      </div>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
