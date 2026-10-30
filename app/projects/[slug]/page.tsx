import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Reveal } from '@/components/animation';
import { Parallax } from '@/components/effects';
import { ProjectGallery } from '@/components/project/ProjectGallery';
import styles from '@/components/project/Project.module.css';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { displayProjects } from '@/data/site-data';

type Params = { params: { slug: string } };

export function generateStaticParams() {
  return displayProjects.map((project) => ({ slug: project.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const project = displayProjects.find((entry) => entry.slug === params.slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

export default function ProjectPage({ params }: Params) {
  const projectIndex = displayProjects.findIndex((entry) => entry.slug === params.slug);
  const project = displayProjects[projectIndex];

  if (!project) {
    notFound();
  }

  const total = displayProjects.length;
  const previousProject = displayProjects[(projectIndex - 1 + total) % total];
  const nextProject = displayProjects[(projectIndex + 1) % total];
  const hero = project.heroMedia?.type === 'image' ? project.heroMedia : undefined;
  const portrait = hero ? hero.height > hero.width : false;

  const links = [
    ...(project.github ? [{ label: 'GitHub repository', href: project.github }] : []),
    ...(project.externalLinks ?? []),
  ];

  const caseSections = [
    { id: 'process', title: 'Development process', items: project.process },
    { id: 'challenges', title: 'Engineering challenges', items: project.challenges },
    { id: 'learnings', title: 'What I learned', items: project.learnings },
  ].filter((section) => section.items?.length);

  return (
    <main>
      {/* ---------- Hero ---------- */}
      <section className={`page-top ${styles.hero} ${portrait ? styles.heroSplit : ''}`}>
        <div className={`page-shell ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <Link href="/#work">
                <Icon name="arrow-left" size={13} /> Work
              </Link>
              <span aria-hidden="true">/</span>
              <span>
                {pad(projectIndex + 1)} of {pad(total)}
              </span>
            </nav>
            <span className="label reveal-eager">{project.category}</span>
            <h1 className={`${styles.title} reveal-eager`} style={{ animationDelay: '0.06s' }}>
              {project.title}
            </h1>
            <p className={`${styles.lead} reveal-eager`} style={{ animationDelay: '0.12s' }}>
              {project.summary}
            </p>
            <div className={`${styles.statusRow} reveal-eager`} style={{ animationDelay: '0.18s' }}>
              <StatusBadge status={project.status} />
              <span>{project.statusNote}</span>
            </div>
            {project.achievement ? (
              <div className={`${styles.achievement} reveal-eager`} style={{ animationDelay: '0.24s' }}>
                <span className="label">{project.achievement.label}</span>
                <strong>{project.achievement.detail}</strong>
              </div>
            ) : null}
          </div>

          {hero ? (
            <figure className={`${styles.heroFigure} reveal-eager`} style={{ animationDelay: '0.1s' }}>
              <div
                className={`corners ${styles.heroFrame}`}
                style={{ width: `min(100%, calc(78svh * ${(hero.width / hero.height).toFixed(4)}))` }}
              >
                <Parallax
                  className={styles.heroMedia}
                  style={{ aspectRatio: `${hero.width} / ${hero.height}` }}
                  amount={5}
                >
                  <Image
                    src={hero.src}
                    alt={hero.alt}
                    fill
                    priority
                    sizes={portrait ? '(max-width: 900px) 100vw, 45vw' : '(max-width: 1280px) 100vw, 1280px'}
                    style={{ objectFit: 'cover' }}
                  />
                </Parallax>
              </div>
              {hero.caption ? (
                <figcaption className={styles.galleryCaption}>
                  <span className={styles.figIndex}>FIG. 00</span>
                  <span>{hero.caption}</span>
                </figcaption>
              ) : null}
            </figure>
          ) : null}
        </div>
      </section>

      {/* ---------- Case study body ---------- */}
      <section className="section">
        <div className={`page-shell ${styles.body}`}>
          <aside className={styles.aside} aria-label="Project specifications">
            <dl className={styles.specSheet}>
              <div>
                <dt>Role</dt>
                <dd>{project.role || 'Independent project work'}</dd>
              </div>
              <div>
                <dt>Discipline</dt>
                <dd>{project.category.split(' / ').join(' · ')}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={project.status} />
                </dd>
              </div>
              <div>
                <dt>Stack</dt>
                <dd className="tag-list">
                  {project.technologies.map((tech) => (
                    <span key={tech} className="tag">
                      {tech}
                    </span>
                  ))}
                </dd>
              </div>
              {links.length ? (
                <div>
                  <dt>Links</dt>
                  <dd className={styles.specLinks}>
                    {links.map((link) => (
                      <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                        {link.label.includes('GitHub') ? <Icon name="github" size={15} /> : null}
                        {link.label}
                        <Icon name="arrow-up-right" size={13} />
                      </a>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>

          <div className={styles.content}>
            <Reveal className={styles.block}>
              <span className="label">Overview</span>
              <p className={styles.overview}>{project.description}</p>
            </Reveal>

            <Reveal className={styles.block}>
              <span className="label">Key specifications</span>
              <ol className={styles.highlights}>
                {project.highlights.map((highlight, index) => (
                  <li key={highlight} className="spotlight">
                    <span className={styles.figIndex}>{pad(index + 1)}</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ol>
            </Reveal>

            {caseSections.map((section) => (
              <Reveal key={section.id} className={styles.block}>
                <span className="label">{section.title}</span>
                <ul className={styles.checklist}>
                  {section.items?.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Reveal>
            ))}

            {project.nextSteps?.length ? (
              <Reveal className={styles.block}>
                <span className="label">Next steps</span>
                <ul className={styles.nextSteps}>
                  {project.nextSteps.map((step) => (
                    <li key={step}>
                      <span className={styles.box} aria-hidden="true" />
                      {step}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------- Gallery ---------- */}
      {project.galleryImages?.length ? (
        <section className="section section--raised">
          <div className="page-shell">
            <div className={styles.galleryHead}>
              <div>
                <span className="label">{project.gallerySection?.eyebrow ?? 'Build log'}</span>
                <h2 className={styles.galleryTitle}>{project.gallerySection?.title ?? 'Build details'}</h2>
              </div>
              <span className={styles.galleryCount}>{pad(project.galleryImages.length)} items</span>
            </div>
            <ProjectGallery media={project.galleryImages} />
          </div>
        </section>
      ) : null}

      {/* ---------- Pager ---------- */}
      <nav className={styles.pager} aria-label="More projects">
        {[
          { project: previousProject, label: 'Previous project', icon: 'arrow-left' as const },
          { project: nextProject, label: 'Next project', icon: 'arrow-right' as const },
        ].map(({ project: target, label, icon }) => (
          <Link key={label} href={`/projects/${target.slug}`} className={styles.pagerItem}>
            {target.heroMedia?.type === 'image' ? (
              <Image src={target.heroMedia.src} alt="" fill sizes="50vw" className={styles.pagerImage} />
            ) : null}
            <span className={styles.pagerShade} aria-hidden="true" />
            <span className={styles.pagerText}>
              <span className="label">{label}</span>
              <span className={styles.pagerTitle}>{target.title}</span>
              <span className={styles.pagerIcon} aria-hidden="true">
                <Icon name={icon} size={18} />
              </span>
            </span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
