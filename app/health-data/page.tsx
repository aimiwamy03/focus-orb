import {
  HEALTH_DATA_CONTACT_BODY,
  HEALTH_DATA_HEADING,
  HEALTH_DATA_INTRO,
  HEALTH_DATA_INVITE_BODY,
  HEALTH_DATA_INVITE_HEADING,
  HEALTH_DATA_READ_BODY,
  HEALTH_DATA_READ_HEADING,
  HEALTH_DATA_STOP_BODY,
  HEALTH_DATA_STOP_HEADING,
  HEALTH_DATA_STORE_BODY,
  HEALTH_DATA_STORE_HEADING,
  PRIVACY_CONTACT_HEADING,
} from '@/lib/legal';
import { LegalChrome, LegalSection } from '@/components/LegalChrome';

export default function HealthDataPage() {
  return (
    <LegalChrome current="health-data">
      <h1
        data-testid="health-data-heading"
        className="text-[length:var(--type-heading)] font-semibold leading-tight text-orb-text"
      >
        {HEALTH_DATA_HEADING}
      </h1>
      <p data-testid="health-data-intro" className="m-0 text-[length:var(--type-whoop)] leading-relaxed">
        {HEALTH_DATA_INTRO}
      </p>
      <LegalSection heading={HEALTH_DATA_READ_HEADING} testId="health-data-read">
        {HEALTH_DATA_READ_BODY}
      </LegalSection>
      <LegalSection heading={HEALTH_DATA_STORE_HEADING} testId="health-data-store">
        {HEALTH_DATA_STORE_BODY}
      </LegalSection>
      <LegalSection heading={HEALTH_DATA_INVITE_HEADING} testId="health-data-invite">
        {HEALTH_DATA_INVITE_BODY}
      </LegalSection>
      <LegalSection heading={HEALTH_DATA_STOP_HEADING} testId="health-data-stop">
        {HEALTH_DATA_STOP_BODY}
      </LegalSection>
      <LegalSection heading={PRIVACY_CONTACT_HEADING} testId="health-data-contact">
        {HEALTH_DATA_CONTACT_BODY}
      </LegalSection>
    </LegalChrome>
  );
}
