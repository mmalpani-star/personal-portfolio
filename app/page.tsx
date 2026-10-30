import Image from 'next/image';
import Link from 'next/link';
import { Navbar, PageShell } from '@/components/layout';
import { Reveal, StaggerContainer, StaggerItem } from '@/components/animation';
import { ProjectMediaFrame } from '@/components/project/ProjectMediaFrame';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { Button, Card, SectionHeading, StatusBadge } from '@/components/ui';
import {
  awards,
  contactLinks,
  currentlyBuilding,
  education,
  experience,
  projects,
  technicalInterests,
  verifiedSkills,
} from '@/data/site-data';

export default function HomePage() {
  const featuredProjects = projects;
  const heroProject = projects[0];

  return (
    <main>
      <Navbar />

      <section className="section hero-section">
        <PageShell>
          <div className="hero-grid">
            <Reveal>
              <div className="hero-copy">
                <div className="eyebrow">01 / Robotics · AI · Physical Systems</div>
                <h1>Learning to build better robots, one iteration at a time.</h1>
                <p>
                  I’m on a continuing journey to learn how to build robots and improve with every
                  iteration. I’m especially interested in computer vision, vision-language-action
                  models, consumer robotics, custom motors for robot joints, reinforcement learning,
                  and the chips behind Tesla’s Full Self-Driving systems.
                </p>
                <div className="tag-list hero-tags">
                  <span className="tag">UC San Diego</span>
                  <span className="tag">B.S. Artificial Intelligence</span>
                  <span className="tag">Expected 2030</span>
                </div>
                <div className="cta-row">
                  <Button href="/#projects" variant="primary">
                    View selected work
                  </Button>
                  <Button href="/about" variant="secondary">
                    About me
                  </Button>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="hero-visual">
                <div className="hero-media-placeholder">
                  {heroProject?.heroMedia ? (
                    <Image
                      src={heroProject.heroMedia.src}
                      alt={heroProject.heroMedia.alt}
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 50vw"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <>
                      <span className="media-label">Project visual placeholder</span>
                      <div className="media-dummy" />
                    </>
                  )}
                </div>
                <div className="hero-meta-panel">
                  <div className="meta-row">
                    <span>Focus</span>
                    <strong>VISION × VLA × REINFORCEMENT LEARNING</strong>
                  </div>
                  <div className="meta-row">
                    <span>Current</span>
                    <strong>Robot systems and embedded hardware</strong>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </PageShell>
      </section>

      <section className="section page-section-divider">
        <PageShell>
          <Reveal>
            <SectionHeading
              eyebrow="02 / Why robotics"
              title="Robots should extend what people can do."
              description="Some tasks are dangerous, repetitive, physically demanding, or simply not worth human time. I am interested in building systems that improve productivity without losing the human element at the center of the work."
            />
          </Reveal>

          <div className="philosophy-grid">
            <Reveal>
              <Card>
                <div className="eyebrow">Focus</div>
                <h3>Practical systems</h3>
                <p>
                  My work lives at the intersection of mechanical design, electronics,
                  embedded systems, and intelligent control.
                </p>
              </Card>
            </Reveal>
            <Reveal delay={0.08}>
              <Card>
                <div className="eyebrow">Applications</div>
                <h3>Real work</h3>
                <p>
                  I care about warehouse automation, search and rescue, ocean exploration,
                  household automation, and industrial systems.
                </p>
              </Card>
            </Reveal>
          </div>
        </PageShell>
      </section>

      <section id="projects" className="section page-section-divider">
        <PageShell>
          <Reveal>
            <SectionHeading
              eyebrow="03 / Selected work"
              title="Systems I’ve built and explored."
              description="A selection of projects spanning robotics, mechanical design, embedded systems, and physical experimentation."
            />
          </Reveal>

          <StaggerContainer className="project-showcase">
            {featuredProjects.map((project, index) => {
              const isLeadProject = index === 0;
              const hasVideoDemo = project.showcaseMedia?.some((media) => media.type === 'video') ?? false;

              return (
                <StaggerItem
                  key={project.slug}
                  className={`project-showcase-item ${isLeadProject ? 'project-showcase-item--lead' : ''}`}
                  delay={index * 0.06}
                >
                  <article className="project-showcase-entry">
                    {project.heroMedia ? (
                      <Link
                        href={`/projects/${project.slug}`}
                        className="project-showcase-image-link"
                        aria-label={`View ${project.title} project`}
                      >
                        <ProjectMediaFrame
                          media={project.heroMedia}
                          metadata={`${String(index + 1).padStart(2, '0')} / ${project.shortTitle}`}
                          priority={isLeadProject}
                          fit="cover"
                          className="project-showcase-frame"
                        />
                      </Link>
                    ) : null}

                    <div className="project-showcase-copy">
                      <div className="eyebrow project-showcase-category">{project.category}</div>
                      <div className="project-showcase-heading">
                        <h3>{project.title}</h3>
                        <StatusBadge status={project.status} />
                      </div>
                      {project.achievement ? (
                        <div className="project-achievement">
                          <span>{project.achievement.label}</span>
                          <strong>{project.achievement.detail}</strong>
                        </div>
                      ) : null}
                      <p>{project.summary}</p>
                      {hasVideoDemo ? <span className="project-video-available">Video demonstration</span> : null}
                      <div className="tag-list project-tags">
                        {project.technologies.slice(0, 3).map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                      {project.showcaseMedia?.length ? (
                        <div className="project-showcase-supporting">
                          {project.showcaseMedia.map((media) => (
                            <ProjectMediaFrame
                              key={media.src}
                              media={media}
                              fit="cover"
                              className="project-showcase-support-frame"
                            />
                          ))}
                        </div>
                      ) : null}
                      <div className="project-actions project-showcase-actions">
                        <Button href={`/projects/${project.slug}`} variant="secondary">
                          View project
                        </Button>
                        {project.github ? (
                          <Button href={project.github} variant="text" target="_blank" rel="noreferrer">
                            GitHub
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </PageShell>
      </section>

      <section id="currently-building" className="section page-section-divider">
        <PageShell>
          <div className="current-grid">
            <Reveal>
              <SectionHeading
                eyebrow="04 / Currently building"
                title={currentlyBuilding.organization}
                description={currentlyBuilding.team}
              />
            </Reveal>

            <Reveal delay={0.08}>
              <Card className="current-card">
                <div className="current-status-row">
                  <StatusBadge status={currentlyBuilding.status} />
                  <span className="current-location">{currentlyBuilding.location}</span>
                </div>
                <div className="current-date">{currentlyBuilding.dates}</div>
                <p>{currentlyBuilding.description}</p>
              </Card>
            </Reveal>
          </div>
        </PageShell>
      </section>

      <section id="interests" className="section page-section-divider">
        <PageShell>
          <Reveal>
            <SectionHeading
              eyebrow="05 / Engineering interests"
              title="The systems and disciplines I care about."
            />
          </Reveal>

          <StaggerContainer className="interest-grid">
            {technicalInterests.map((interest, index) => (
              <StaggerItem key={interest} delay={index * 0.03}>
                <div className="interest-item">
                  <span className="interest-number">{String(index + 1).padStart(2, '0')}</span>
                  <span>{interest}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </PageShell>
      </section>

      <section id="experience" className="section page-section-divider">
        <PageShell>
          <Reveal>
            <SectionHeading
              eyebrow="06 / Experience + education"
              title="A practical engineering path."
            />
          </Reveal>

          <div className="experience-grid">
            <div className="experience-column">
              {experience.map((item) => (
                <Card key={`${item.title}-${item.organization}`} className="timeline-card">
                  <div className="eyebrow">{item.dates || 'Experience'}</div>
                  <h3>{item.title}</h3>
                  <p>{item.organization}</p>
                  {item.location ? <p>{item.location}</p> : null}
                  {item.details ? (
                    <ul>
                      {item.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}
                  {item.images?.map((image) => (
                    <MediaFrame key={image.src} caption={image.caption}>
                      <Image
                        src={image.src}
                        alt={image.alt}
                        width={image.width}
                        height={image.height}
                        sizes="(max-width: 980px) 100vw, 60vw"
                        style={{ width: '100%', height: 'auto' }}
                      />
                    </MediaFrame>
                  ))}
                  {item.videos?.map((video) => (
                    <MediaFrame key={video.src} caption={video.caption}>
                      <video
                        src={video.src}
                        aria-label={video.alt}
                        controls
                        playsInline
                        muted
                        preload="metadata"
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                      />
                    </MediaFrame>
                  ))}
                  {item.socialLink ? (
                    <Button
                      href={item.socialLink.href}
                      variant="text"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.socialLink.label}
                    </Button>
                  ) : null}
                </Card>
              ))}
            </div>

            <div className="experience-column">
              <Card className="timeline-card">
                <div className="eyebrow">Education</div>
                {education.map((item) => (
                  <div key={`${item.institution}-${item.degree}`}>
                    <h3>{item.institution}</h3>
                    <p>{item.degree}</p>
                    {item.dates ? <p>{item.dates}</p> : null}
                    {item.expectedGraduation ? (
                      <p>Expected graduation: {item.expectedGraduation}</p>
                    ) : null}
                    {item.details ? (
                      <ul>
                        {item.details.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </PageShell>
      </section>

      <section id="awards" className="section page-section-divider">
        <PageShell>
          <Reveal>
            <SectionHeading eyebrow="07 / Awards" title="Recognition along the way." />
          </Reveal>

          <div className="awards-grid">
            {awards.map((award) => (
              <Card key={award.name} className="award-card">
                <div className="eyebrow">{award.year || 'Award'}</div>
                <h3>{award.name}</h3>
                <p>{award.detail}</p>
              </Card>
            ))}
          </div>
        </PageShell>
      </section>

      <section id="contact" className="section page-section-divider">
        <PageShell>
          <div className="contact-panel">
            <Reveal>
              <SectionHeading
                eyebrow="08 / Contact"
                title="Let’s build something useful."
                description="I’m interested in robotics, AI, embedded systems, and physical engineering work that creates real utility."
              />
            </Reveal>

            <Reveal delay={0.08}>
              <div className="contact-actions">
                {contactLinks.map((link) => (
                  <Button key={link.label} href={link.href} variant="secondary" target="_blank" rel="noreferrer">
                    {link.label}
                  </Button>
                ))}
              </div>
            </Reveal>
          </div>
        </PageShell>
      </section>

      <footer className="site-footer">
        <PageShell>
          <div className="footer-inner">
            <div>
              <div className="eyebrow">Madhav Malpani</div>
              <div className="footer-tag">AI × ROBOTICS × PHYSICAL SYSTEMS</div>
            </div>
            <div className="footer-links">
              <a href="/about">About</a>
              <a href="/#projects">Work</a>
              <a href="/#contact">Contact</a>
            </div>
          </div>
        </PageShell>
      </footer>
    </main>
  );
}
