import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="section">
      <div className="container">
        <div className="eyebrow">404</div>
        <h1>Project not found.</h1>
        <p>The requested project route does not exist or is unavailable.</p>
        <Link href="/" className="link-button" style={{ marginTop: 12 }}>
          Return home
        </Link>
      </div>
    </main>
  );
}
