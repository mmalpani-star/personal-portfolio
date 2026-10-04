import Link from 'next/link';

export function Navbar() {
  return (
    <header className="site-header">
      <div className="page-shell navbar-shell">
        <Link href="/" className="brand-mark" aria-label="Madhav Malpani home">
          Madhav Malpani
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/#projects">Work</Link>
          <Link href="/about">About</Link>
          <Link href="/#contact">Contact</Link>
        </nav>

        <div className="nav-actions">
          <a className="button button-secondary" href="/documents/resume.pdf" target="_blank" rel="noopener noreferrer">
            Resume
          </a>
        </div>
      </div>
    </header>
  );
}
