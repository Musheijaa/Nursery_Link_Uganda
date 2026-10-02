import { en } from '../../copy/en';

/**
 * Canopy and root notes laid out like a labelled herbarium specimen: one tree drawing, with
 * leader lines from its crown and its roots to the notes.
 */
export const SpecimenPlate = ({ canopy, roots }: { canopy: string | null; roots: string | null }) => {
  if (!canopy && !roots) return null;
  return (
    <div className="grid grid-cols-[96px_1fr] gap-x-3 sm:grid-cols-[150px_1fr] sm:gap-x-4">
      <svg viewBox="0 0 150 300" aria-hidden className="row-span-2 h-full w-full">
        {/* Crown */}
        <path
          d="M75 18c-30 0-52 18-55 42-18 6-24 26-12 40 10 12 30 14 44 8 8 10 32 10 40 0 14 6 34 4 44-8 12-14 6-34-12-40C127 36 105 18 75 18Z"
          fill="var(--color-seedling-tint)"
          stroke="var(--color-seedling)"
          strokeWidth="2.5"
        />
        {/* Trunk */}
        <path d="M68 108c2 30 0 62-4 92h22c-4-30-6-62-4-92" fill="var(--color-paper)" stroke="var(--color-canopy)" strokeWidth="2.5" strokeLinejoin="round" />
        {/* Ground */}
        <line x1="6" x2="144" y1="200" y2="200" stroke="var(--color-bark-muted)" strokeWidth="2" strokeDasharray="5 5" />
        {/* Roots */}
        <path d="M75 200v80M75 222c-14 8-30 10-46 22M75 222c14 8 30 10 46 22M75 246c-8 8-18 14-26 26M75 246c8 8 18 14 26 26" fill="none" stroke="var(--color-canopy)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Leader lines towards the notes */}
        {canopy && <path d="M128 64h22" stroke="var(--color-canopy)" strokeWidth="1.5" />}
        {roots && <path d="M121 244h29" stroke="var(--color-canopy)" strokeWidth="1.5" />}
      </svg>
      <div className="flex flex-col justify-start border-l-2 border-canopy/30 pt-2 pl-3">
        {canopy && (
          <>
            <h3 className="font-serif text-base font-semibold">{en.species.canopy}</h3>
            <p>{canopy}</p>
          </>
        )}
      </div>
      <div className="flex flex-col justify-end border-l-2 border-canopy/30 pb-2 pl-3">
        {roots && (
          <>
            <h3 className="font-serif text-base font-semibold">{en.species.roots}</h3>
            <p>{roots}</p>
          </>
        )}
      </div>
    </div>
  );
};
