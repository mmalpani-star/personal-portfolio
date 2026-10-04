import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { PageShell } from '@/components/layout/PageShell';
import { ProjectMediaFrame } from '@/components/project/ProjectMediaFrame';
import { Button, Card, SectionHeading, StatusBadge } from '@/components/ui';
import { projects } from '@/data/site-data';

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export default function ProjectPage({ params }: { params: { slug: string } }) {
  const projectIndex = projects.findIndex((entry) => entry.slug === params.slug);
  const project = projects[projectIndex];

  if (!project) {
    notFound();
  }

  const previousProject = projectIndex > 0 ? projects[projectIndex - 1] : undefined;
  const nextProject = projectIndex < projects.length - 1 ? projects[projectIndex + 1] : undefined;

  return (
    <main>
      <Navbar />

      <section className="section hero-section">
        <PageShell>
          <div className="eyebrow">{project.category}</div>
          <h1>{project.title}</h1>
          <StatusBadge status={project.status} />
          <p style={{ marginTop: 18 }}>{project.statusNote}</p>
          {project.heroMedia ? (
            <div style={{ marginTop: 32 }}>
              <ProjectMediaFrame media={project.heroMedia} metadata={project.shortTitle} priority />
            </div>
          ) : null}
        </PageShell>
      </section>

      <section className="section">
        <PageShell className="two-col">
          <div>
            <div className="eyebrow">Overview</div>
            <p>{project.description}</p>
          </div>
          <div>
            <div className="eyebrow">Role</div>
            <p>{project.role || 'Independent project work'}</p>
            <div className="tag-list hero-tags">
              {project.technologies.map((tech) => (
                <span key={tech} className="tag">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </PageShell>
      </section>

      {project.galleryImages?.length ? (
        <section className="section">
          <PageShell>
            <SectionHeading eyebrow="Project media" title="Build details" />
            <div className="two-col">
              {project.galleryImages.map((media) => (
                <ProjectMediaFrame key={media.src} media={media} />
              ))}
            </div>
          </PageShell>
        </section>
      ) : null}

      <section className="section">
        <PageShell>
          <div className="eyebrow">Highlights</div>
          <div className="grid-3">
            {project.highlights.map((highlight) => (
              <Card key={highlight}>
                <h3>{highlight}</h3>
              </Card>
            ))}
          </div>
        </PageShell>
      </section>

      {project.github || project.externalLinks?.length ? (
        <section className="section">
          <PageShell>
            <div className="eyebrow">Links</div>
            <div className="cta-row">
              {project.github ? (
                <Button href={project.github} variant="secondary" target="_blank" rel="noreferrer">
                  GitHub
                </Button>
              ) : null}
              {project.externalLinks?.map((link) => (
                <Button key={link.href} href={link.href} variant="secondary" target="_blank" rel="noreferrer">
                  {link.label}
                </Button>
              ))}
            </div>
          </PageShell>
        </section>
      ) : null}

      {project.nextSteps?.length ? (
        <section className="section">
          <PageShell>
            <div className="eyebrow">Next steps</div>
            <ul>
              {project.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </PageShell>
        </section>
      ) : null}

      <section className="section">
        <PageShell className="cta-row">
          <Button href="/#projects" variant="secondary">
            Back to Work
          </Button>
          {previousProject ? (
            <Link href={`/projects/${previousProject.slug}`} className="button button-text">
              Previous: {previousProject.shortTitle}
            </Link>
          ) : null}
          {nextProject ? (
            <Link href={`/projects/${nextProject.slug}`} className="button button-text">
              Next: {nextProject.shortTitle}
            </Link>
          ) : null}
        </PageShell>
      </section>
    </main>
  );
}
