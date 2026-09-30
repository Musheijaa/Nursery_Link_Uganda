import { Region } from '../types';

export interface PlantingSeason {
  area: string;
  regions: Region[];
  /** Month indexes (0 = Jan) that are good planting months */
  plantingMonths: number[];
  note: string;
}

// General guidance based on Uganda's rainfall pattern: two rainy seasons in the south and
// centre, one longer season in the north. Local timing varies year to year.
export const PLANTING_SEASONS: PlantingSeason[] = [
  {
    area: 'Central & Lake Victoria',
    regions: ['Central'],
    plantingMonths: [2, 3, 4, 8, 9, 10],
    note: 'Two seasons: March–May and September–November.',
  },
  {
    area: 'Western & South-western',
    regions: ['Western'],
    plantingMonths: [2, 3, 4, 8, 9, 10],
    note: 'Two seasons. Highland areas stay moist longer.',
  },
  {
    area: 'Eastern & Mt Elgon',
    regions: ['Eastern'],
    plantingMonths: [2, 3, 4, 7, 8, 9],
    note: 'March–May, and August–October on the Elgon slopes.',
  },
  {
    area: 'Northern & West Nile',
    regions: ['Northern'],
    plantingMonths: [3, 4, 5, 6],
    note: 'One long season. Plant April–July so trees establish before the dry season.',
  },
];

export const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
