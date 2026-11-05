import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

export default function NotFound() {
  return (
    <main>
      <section className="page-top section">
        <div className="page-shell">
          <span className="label">404 — Not found</span>
          <h1 style={{ marginTop: 20 }}>This page doesn’t exist.</h1>
          <p style={{ maxWidth: '48ch', fontSize: 'var(--text-lg)' }}>
            The requested page does not exist or is unavailable.
          </p>
          <div className="cta-row" style={{ marginTop: 32 }}>
            <Link href="/" className="button button-primary">
              <Icon name="arrow-left" size={15} />
              Return home
            </Link>
            <Link href="/#work" className="button button-secondary">
              View the work
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
