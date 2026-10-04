import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Madhav Malpani',
  description: 'Robotics, AI, and physical systems portfolio',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
