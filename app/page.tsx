'use client';

import { Suspense } from 'react';
import { Orb } from '@/components/Orb';

function OrbWrapper() {
  return <Orb />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <OrbWrapper />
    </Suspense>
  );
}
