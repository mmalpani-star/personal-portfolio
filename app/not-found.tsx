import { Navbar, PageShell } from '@/components/layout';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <main>
      <Navbar />
      <section className="section">
        <PageShell>
          <div className="eyebrow">404</div>
          <h1>Page not found.</h1>
          <p>The requested page does not exist or is unavailable.</p>
          <div className="cta-row">
            <Button href="/" variant="secondary">
              Return home
            </Button>
          </div>
        </PageShell>
      </section>
    </main>
  );
}
