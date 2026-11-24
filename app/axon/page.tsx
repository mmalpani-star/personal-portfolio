import { ParticleCloud } from '@/components/axon/ParticleCloud';

export const metadata = {
  title: 'AXON',
  description: 'AXON — motion research.',
};

export default function AxonPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: '#000',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      <ParticleCloud />
    </div>
  );
}
