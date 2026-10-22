import { Suspense } from 'react';
import { Orb } from '@/components/Orb';

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <Orb />
    </Suspense>
  );
}
