import { en } from '../copy/en';

/** "No exact match for “mvulle”. Showing results for Mvule." when the API corrected a misspelling. */
export const CorrectedNote = ({ typed, corrected }: { typed: string; corrected: string }) => (
  <p role="status" className="rounded-md bg-sky-tint px-3 py-2 text-sm text-bark">
    {en.search.noExactMatch(typed.trim())} {en.search.showingFor} <strong className="text-lake">{corrected}</strong>.
  </p>
);
