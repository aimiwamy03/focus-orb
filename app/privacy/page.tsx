import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#161616]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-16 text-[length:var(--type-log-body)] text-orb-dim">
      <p>
        <Link href="/" className="text-orb-quiet underline-offset-4 hover:text-orb-text hover:underline">
          Focus Orb
        </Link>
      </p>
      <h1 className="text-[length:var(--type-heading)] font-semibold text-orb-text">Privacy</h1>
      <p>
        Focus Orb is a focus timer. Signing in with Google is only used to read the calendars you
        pick, so the orb can make room for meetings.
      </p>
      <p>
        Connecting WHOOP is optional. If you connect it, Focus Orb asks WHOOP for recovery, sleep,
        cycles, and workouts. Those numbers stay in an encrypted cookie on this browser. They are
        not written to a database, and they are not printed in server logs. Disconnecting WHOOP in
        Settings revokes access and deletes the cookie.
      </p>
      <p>
        You can keep using Focus Orb without WHOOP. Suggestions never block you from starting a
        different length.
      </p>
      </div>
    </main>
  );
}
