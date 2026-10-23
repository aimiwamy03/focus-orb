import { LegalLinks } from '@/components/LegalLinks';
import { ABOUT_BODY, ABOUT_HEADING } from '@/lib/legal';

export default function AboutPage() {
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#161616]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-16 text-[length:var(--type-whoop)] leading-relaxed text-orb-dim">
        <LegalLinks current="about" />
        <h1
          data-testid="about-heading"
          className="text-[length:var(--type-heading)] font-semibold text-orb-text"
        >
          {ABOUT_HEADING}
        </h1>
        <p data-testid="about-body">{ABOUT_BODY}</p>
      </div>
    </main>
  );
}
