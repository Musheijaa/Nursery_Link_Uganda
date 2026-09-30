const numberFormat = new Intl.NumberFormat('en-UG');
const compactFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export const formatNumber = (n: number) => numberFormat.format(n);

export const formatCompact = (n: number) => compactFormat.format(n);

export const formatUGX = (n: number) => `UGX ${numberFormat.format(Math.round(n))}`;

/** e.g. "31 Oct 2026" */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const pluralise = (count: number, singular: string, plural = `${singular}s`) =>
  `${formatNumber(count)} ${count === 1 ? singular : plural}`;
