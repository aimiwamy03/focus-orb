import {
  GOOGLE_LIMITED_USE_URL,
  PRIVACY_CONTACT_BODY,
  PRIVACY_CONTACT_HEADING,
  PRIVACY_DATA_BODY,
  PRIVACY_DATA_HEADING,
  PRIVACY_HEADING,
  PRIVACY_INTRO,
  PRIVACY_LIMITED_USE,
  PRIVACY_REVOKE_BODY,
  PRIVACY_REVOKE_HEADING,
  PRIVACY_SHARE_BODY,
  PRIVACY_SHARE_HEADING,
  PRIVACY_STORE_BODY,
  PRIVACY_STORE_HEADING,
  PRIVACY_USE_BODY,
  PRIVACY_USE_HEADING,
  PRIVACY_WHOOP_BODY,
  PRIVACY_WHOOP_HEADING,
} from '@/lib/legal';
import { LegalChrome, LegalSection } from '@/components/LegalChrome';

export default function PrivacyPage() {
  return (
    <LegalChrome current="privacy">
      <h1
        data-testid="privacy-heading"
        className="text-[length:var(--type-heading)] font-semibold leading-tight text-orb-text"
      >
        {PRIVACY_HEADING}
      </h1>
      <p data-testid="privacy-intro" className="m-0 text-[length:var(--type-whoop)] leading-relaxed">
        {PRIVACY_INTRO}
      </p>
      <LegalSection heading={PRIVACY_DATA_HEADING} testId="privacy-data">
        {PRIVACY_DATA_BODY}
      </LegalSection>
      <LegalSection heading={PRIVACY_USE_HEADING} testId="privacy-use">
        {PRIVACY_USE_BODY}
      </LegalSection>
      <LegalSection heading={PRIVACY_SHARE_HEADING} testId="privacy-share">
        {PRIVACY_SHARE_BODY}
      </LegalSection>
      <LegalSection heading={PRIVACY_STORE_HEADING} testId="privacy-store">
        {PRIVACY_STORE_BODY}
      </LegalSection>
      <LegalSection heading={PRIVACY_REVOKE_HEADING} testId="privacy-revoke">
        {PRIVACY_REVOKE_BODY}
      </LegalSection>
      <LegalSection heading={PRIVACY_CONTACT_HEADING} testId="privacy-contact">
        {PRIVACY_CONTACT_BODY}
      </LegalSection>
      <section data-testid="privacy-limited-use" className="flex flex-col gap-3">
        <h2 className="text-[length:var(--type-heading)] font-semibold leading-tight text-orb-text">
          Google API Services User Data Policy
        </h2>
        <p className="m-0 text-[length:var(--type-whoop)] leading-relaxed text-orb-text">
          {PRIVACY_LIMITED_USE}{' '}
          <a
            href={GOOGLE_LIMITED_USE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Google API Services User Data Policy
          </a>
          .
        </p>
      </section>
      <LegalSection heading={PRIVACY_WHOOP_HEADING} testId="privacy-whoop">
        {PRIVACY_WHOOP_BODY}
      </LegalSection>
    </LegalChrome>
  );
}
