import { LegalLinks } from '@/components/LegalLinks';
import {
  PRIVACY_CONTACT_BODY,
  PRIVACY_CONTACT_HEADING,
  PRIVACY_HEADING,
  PRIVACY_INTRO,
  PRIVACY_WHOOP_BODY,
  PRIVACY_WHOOP_HEADING,
} from '@/lib/legal';

export default function PrivacyPage() {
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#161616]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-16 text-[length:var(--type-whoop)] leading-relaxed text-orb-dim">
        <LegalLinks current="privacy" />
        <h1
          data-testid="privacy-heading"
          className="text-[length:var(--type-heading)] font-semibold text-orb-text"
        >
          {PRIVACY_HEADING}
        </h1>
        <p data-testid="privacy-intro">{PRIVACY_INTRO}</p>
        <section data-testid="privacy-whoop" className="flex flex-col gap-3">
          <h2 className="text-[length:var(--type-heading)] font-semibold text-orb-text">
            {PRIVACY_WHOOP_HEADING}
          </h2>
          <p>{PRIVACY_WHOOP_BODY}</p>
        </section>
        <section data-testid="privacy-contact" className="flex flex-col gap-3">
          <h2 className="text-[length:var(--type-heading)] font-semibold text-orb-text">
            {PRIVACY_CONTACT_HEADING}
          </h2>
          <p>{PRIVACY_CONTACT_BODY}</p>
        </section>
      </div>
    </main>
  );
}
