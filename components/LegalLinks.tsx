'use client';

import Link from 'next/link';
import {
  ABOUT_LABEL,
  HEALTH_DATA_LABEL,
  HOME_LABEL,
  PRIVACY_LABEL,
} from '@/lib/legal';

export type LegalCurrent = 'home' | 'about' | 'privacy' | 'health-data';

const LINKS: Array<{ href: string; label: string; id: LegalCurrent; testId: string }> = [
  { href: '/', label: HOME_LABEL, id: 'home', testId: 'legal-home' },
  { href: '/about', label: ABOUT_LABEL, id: 'about', testId: 'legal-about' },
  { href: '/privacy', label: PRIVACY_LABEL, id: 'privacy', testId: 'legal-privacy' },
  { href: '/health-data', label: HEALTH_DATA_LABEL, id: 'health-data', testId: 'legal-health-data' },
];

export function LegalLinks({
  current,
  testId = 'legal-links',
}: {
  current?: LegalCurrent;
  testId?: string;
}) {
  return (
    <nav
      data-testid={testId}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--type-whoop)] text-orb-dim"
    >
      {LINKS.map((link, index) => (
        <span key={link.id} className="inline-flex items-center gap-3">
          {index > 0 ? <span className="text-orb-quiet">·</span> : null}
          {current === link.id ? (
            <span data-testid={link.testId} className="text-orb-text">
              {link.label}
            </span>
          ) : (
            <Link
              href={link.href}
              data-testid={link.testId}
              className="text-orb-text underline underline-offset-4 hover:text-white"
            >
              {link.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
