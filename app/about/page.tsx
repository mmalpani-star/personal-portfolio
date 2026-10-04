import { Navbar, PageShell } from '@/components/layout';
import { Button, Card, SectionHeading } from '@/components/ui';
import { education, technicalInterests, verifiedSkills } from '@/data/site-data';

export default function AboutPage() {
  return (
    <main>
      <Navbar />

      <section className="section">
        <PageShell>
          <SectionHeading
            eyebrow="About"
            title="Student engineer building physical systems."
            description="I am an undergraduate builder focused on robotics, AI, and physical systems."
          />
          <p>
            I am an undergraduate student at UC San Diego pursuing a B.S. in Artificial
            Intelligence, with a strong interest in robotics, artificial intelligence, physical
            AI, and autonomous systems. I am interested in engineering systems that extend human
            capability and tackle dangerous, repetitive, difficult, or demanding work.
          </p>
          <div style={{ marginTop: 24 }}>
            <Button href="/" variant="primary">Return home</Button>
          </div>
        </PageShell>
      </section>

      <section className="section page-section-divider">
        <PageShell>
          <div className="two-col">
            <Card>
              <div className="eyebrow">Education</div>
              {education.map((item) => (
                <div key={`${item.institution}-${item.degree}`}>
                  <h3>{item.institution}</h3>
                  <p>{item.degree}</p>
                  <p>{item.expectedGraduation}</p>
                </div>
              ))}
            </Card>

            <Card>
              <div className="eyebrow">Focus</div>
              <div className="tag-list">
                {technicalInterests.map((interest) => (
                  <span key={interest} className="tag">
                    {interest}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </PageShell>
      </section>

      <section className="section page-section-divider">
        <PageShell>
          <SectionHeading eyebrow="Tools" title="Verified skills and tools." />
          <div className="grid-3">
            <Card>
              <h3>Programming</h3>
              <ul>
                {verifiedSkills.programming.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3>Engineering</h3>
              <ul>
                {verifiedSkills.engineering.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3>Software</h3>
              <ul>
                {verifiedSkills.software.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </Card>
          </div>
        </PageShell>
      </section>
    </main>
  );
}
