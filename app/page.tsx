import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { Orb } from '@/components/Orb';
import { PublicHome } from '@/components/PublicHome';
import { showsAppShell } from '@/lib/legal';
import { interpretAuthSession, shouldUseGoogleFromSession } from '@/lib/onboarding';

function OrbShell() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <Orb />
    </Suspense>
  );
}

async function HomeBody({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (showsAppShell(params)) return <OrbShell />;

  try {
    await connection();
    const session = await auth();
    if (shouldUseGoogleFromSession(interpretAuthSession(session))) {
      return <OrbShell />;
    }
  } catch {
    // Unconfigured auth still shows the public homepage.
  }

  return <PublicHome current="home" />;
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <HomeBody searchParams={searchParams} />
    </Suspense>
  );
}
