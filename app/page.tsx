'use client';

import { Suspense } from 'react';
import { Orb } from '@/components/Orb';

function OrbWrapper() {
  return <Orb />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="w-screen h-screen bg-black" />}>
      <OrbWrapper />
    </Suspense>
  );
}
