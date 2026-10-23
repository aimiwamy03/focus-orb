import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ABOUT_LABEL,
  HEALTH_DATA_LABEL,
  HOME_LABEL,
  PRIVACY_LABEL,
  TERMS_LABEL,
} from '@/lib/legal';

export type LegalCurrent = 'about' | 'privacy' | 'terms' | 'health-data' | 'home';

const LINKS: Array<{ href: string; label: string; id: Exclude<LegalCurrent, 'home'> }> = [
  { href: '/about', label: ABOUT_LABEL, id: 'about' },
  { href: '/privacy', label: PRIVACY_LABEL, id: 'privacy' },
  { href: '/health-data', label: HEALTH_DATA_LABEL, id: 'health-data' },
  { href: '/terms', label: TERMS_LABEL, id: 'terms' },
];

export function LegalNav({ current }: { current?: LegalCurrent }) {
  return (
    <nav
      data-testid="legal-nav"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[length:var(--type-whoop)] leading-snug"
    >
      <Link
        href="/"
        data-testid="legal-home"
        className={`text-orb-text underline-offset-4 hover:underline ${
          current === 'home' ? 'underline' : ''
        }`}
      >
        {HOME_LABEL}
      </Link>
      {LINKS.map((link) => (
        <Link
          key={link.id}
          href={link.href}
          data-testid={`legal-${link.id}`}
          className={`text-orb-text underline-offset-4 hover:underline ${
            current === link.id ? 'underline' : ''
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function LegalChrome({
  current,
  children,
}: {
  current?: LegalCurrent;
  children: ReactNode;
}) {
  return (
    <main
      data-testid="legal-page"
      data-legal={current ?? 'home'}
      className="fixed inset-0 overflow-y-auto bg-black px-6 py-16 text-orb-text"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <LegalNav current={current} />
        {children}
      </div>
    </main>
  );
}

export function LegalSection({
  heading,
  children,
  testId,
}: {
  heading: string;
  children: ReactNode;
  testId: string;
}) {
  return (
    <section data-testid={testId} className="flex flex-col gap-3">
      <h2 className="text-[length:var(--type-heading)] font-semibold leading-tight text-orb-text">
        {heading}
      </h2>
      <p className="m-0 text-[length:var(--type-whoop)] leading-relaxed text-orb-text">{children}</p>
    </section>
  );
}
