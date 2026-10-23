import { TERMS_BODY, TERMS_HEADING, TERMS_INTRO } from '@/lib/legal';
import { LegalChrome } from '@/components/LegalChrome';

export default function TermsPage() {
  return (
    <LegalChrome current="terms">
      <h1
        data-testid="terms-heading"
        className="text-[length:var(--type-heading)] font-semibold leading-tight text-orb-text"
      >
        {TERMS_HEADING}
      </h1>
      <p data-testid="terms-intro" className="m-0 text-[length:var(--type-whoop)] leading-relaxed">
        {TERMS_INTRO}
      </p>
      <p data-testid="terms-body" className="m-0 text-[length:var(--type-whoop)] leading-relaxed">
        {TERMS_BODY}
      </p>
    </LegalChrome>
  );
}
