import { LegalLinks } from '@/components/LegalLinks';
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

function Section({
  heading,
  body,
  testId,
}: {
  heading: string;
  body: string;
  testId: string;
}) {
  return (
    <section data-testid={testId} className="flex flex-col gap-3">
      <h2 className="text-[length:var(--type-heading)] font-semibold text-orb-text">{heading}</h2>
      <p>{body}</p>
    </section>
  );
}

export default function HealthDataPage() {
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#161616]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-16 text-[length:var(--type-whoop)] leading-relaxed text-orb-dim">
        <LegalLinks current="health-data" />
        <h1
          data-testid="health-data-heading"
          className="text-[length:var(--type-heading)] font-semibold text-orb-text"
        >
          {HEALTH_DATA_HEADING}
        </h1>
        <p data-testid="health-data-intro">{HEALTH_DATA_INTRO}</p>
        <Section
          heading={HEALTH_DATA_READ_HEADING}
          body={HEALTH_DATA_READ_BODY}
          testId="health-data-read"
        />
        <Section
          heading={HEALTH_DATA_STORE_HEADING}
          body={HEALTH_DATA_STORE_BODY}
          testId="health-data-store"
        />
        <Section
          heading={HEALTH_DATA_INVITE_HEADING}
          body={HEALTH_DATA_INVITE_BODY}
          testId="health-data-invite"
        />
        <Section
          heading={HEALTH_DATA_STOP_HEADING}
          body={HEALTH_DATA_STOP_BODY}
          testId="health-data-stop"
        />
        <Section
          heading={PRIVACY_CONTACT_HEADING}
          body={HEALTH_DATA_CONTACT_BODY}
          testId="health-data-contact"
        />
      </div>
    </main>
  );
}
