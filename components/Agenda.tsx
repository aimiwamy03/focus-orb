'use client';

import {
  AGENDA_LEFT,
  AGENDA_SOFT_ACCENT,
  AGENDA_WIDTH,
  type AgendaSection,
} from '@/lib/agenda';

export function Agenda({
  sections,
  faded = false,
}: {
  sections: AgendaSection[];
  faded?: boolean;
}) {
  return (
    <aside
      data-testid="agenda"
      data-text-clear
      className={`pointer-events-none absolute z-20 max-h-[min(78vh,36rem)] overflow-hidden rounded-2xl px-4 py-5 transition-opacity duration-300 ${
        faded ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        left: AGENDA_LEFT,
        top: '50%',
        width: AGENDA_WIDTH,
        transform: 'translateY(-50%)',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {sections.map((section) => (
        <section
          key={section.key}
          data-testid={`agenda-${section.key}`}
          className={section.key === 'today' ? '' : 'mt-5'}
        >
          {section.key === 'today' ? (
            <div className="mb-3">
              <div
                data-testid="agenda-weekday"
                className="text-[length:var(--type-hint)] font-medium tracking-[0.16em]"
                style={{ color: AGENDA_SOFT_ACCENT }}
              >
                {section.weekday}
              </div>
              <div
                data-testid="agenda-day-number"
                className="text-[length:var(--type-heading)] font-semibold leading-none text-orb-text"
                style={{ fontSize: 'clamp(36px, 3.4vw, 46px)' }}
              >
                {section.dayNumber}
              </div>
            </div>
          ) : (
            <div
              data-testid={`agenda-heading-${section.key}`}
              className="mb-2 text-[length:var(--type-hint)] font-medium tracking-[0.14em]"
              style={{ color: AGENDA_SOFT_ACCENT }}
            >
              {section.heading}
            </div>
          )}

          {section.emptyLabel ? (
            <div
              data-testid="agenda-empty"
              className="text-[length:var(--type-hint)] text-orb-quiet"
            >
              {section.emptyLabel}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {section.items.map((item) => (
                <li
                  key={item.id}
                  data-testid={`agenda-event-${item.title}`}
                  data-next={item.isNext ? 'true' : 'false'}
                  className="flex gap-2.5"
                >
                  <span
                    aria-hidden
                    className="mt-1 h-8 w-0.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <div
                      className={`truncate text-[length:var(--type-status)] font-medium leading-snug ${
                        item.isNext ? 'text-orb-text' : 'text-orb-dim'
                      }`}
                    >
                      {item.title}
                    </div>
                    <div className="text-[length:var(--type-hint)] leading-5 text-orb-quiet">
                      {item.timeLabel}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </aside>
  );
}
