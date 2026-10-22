import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ABOUT_LABEL,
  HOME_LABEL,
  PRIVACY_LABEL,
  TERMS_LABEL,
} from '@/lib/legal';

export function LegalNav({ current }: { current?: 'about' | 'privacy' | 'terms' | 'home' }) {
  const links = [
    { href: '/about', label: ABOUT_LABEL, id: 'about' as const },
    { href: '/privacy', label: PRIVACY_LABEL, id: 'privacy' as const },
    { href: '/terms', label: TERMS_LABEL, id: 'terms' as const },
  ];
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
      {links.map((link) => (
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
  current?: 'about' | 'privacy' | 'terms' | 'home';
  children: ReactNode;
}) {
  return (
    <main
      data-testid="legal-page"
      data-legal={current ?? 'home'}
      className="min-h-screen overflow-y-auto bg-black px-6 py-16 text-orb-text"
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
