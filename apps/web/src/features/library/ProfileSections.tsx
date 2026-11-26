import { speciesProfileSections, type SpeciesProfileField } from '@nurserylink/shared';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { en } from '../../copy/en';
import { DESKTOP, useMedia } from '../../lib/media';
import { paragraphs } from '../content/api';

export type ProfileValues = Record<SpeciesProfileField, string | null>;

/** The fields of a section that have text: empty ones are never shown (no "N/A"). */
export const filledFields = (s: ProfileValues, fields: readonly SpeciesProfileField[]) => fields.filter(f => !!s[f]?.trim());

const FieldText = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1">
    <h3 className="text-base font-bold text-canopy">{label}</h3>
    {paragraphs(value).map(lines => <p key={lines.join()}>{lines.map((l, i) => (i === 0 ? l : <span key={l}><br />{l}</span>))}</p>)}
  </div>
);

/**
 * One of sections 2–5 of a species page, as a card. On phones it folds away (an accordion), so the
 * page stays short; on wider screens it's always open.
 */
export const ProfileSection = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => {
  const desktop = useMedia(DESKTOP);
  const card = 'flex flex-col gap-4 rounded-lg bg-paper p-5 shadow-card ring-1 ring-line md:p-6';
  if (desktop) {
    return (
      <section aria-labelledby={id} className={card}>
        <h2 id={id} className="text-h3">{title}</h2>
        {children}
      </section>
    );
  }
  return (
    <details className={`group ${card}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
        <h2 id={id} className="text-h4">{title}</h2>
        <ChevronDown aria-hidden className="size-6 shrink-0 text-forest transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="flex flex-col gap-4">{children}</div>
    </details>
  );
};

/**
 * Sections 2–5 of the Tree Library profile (About the Tree, Where Does It Grow Best?, How to Grow It,
 * Uses and Benefits). A section with nothing written is left out; `extra` adds content to a section
 * (the growth chart in About the Tree), which also keeps it shown.
 */
export const ProfileSections = ({ s, extra = {} }: { s: ProfileValues; extra?: Partial<Record<'about' | 'where' | 'grow' | 'uses', ReactNode>> }) => (
  <>
    {speciesProfileSections
      .filter(section => section.key !== 'identity')
      .map(section => {
        const key = section.key;
        const fields = filledFields(s, section.fields);
        const more = extra[key];
        if (!fields.length && !more) return null;
        return (
          <ProfileSection key={key} id={`section-${key}`} title={en.species.sections[key]}>
            {fields.map(f => <FieldText key={f} label={en.species.fields[f]} value={s[f] ?? ''} />)}
            {more}
          </ProfileSection>
        );
      })}
  </>
);
