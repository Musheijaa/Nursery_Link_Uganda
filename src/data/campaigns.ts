import { FreeCampaign } from '../types';

export const FREE_CAMPAIGNS: FreeCampaign[] = [
  {
    id: 'community-tree-planting-mukono',
    title: 'Community Tree Planting',
    sponsorName: 'National Forestry Authority (NFA) & Mukono DLG',
    sponsorType: 'Local Gov',
    logoType: 'tree',
    description: 'Funding for indigenous species aimed at restoring degraded public lands and improving local biodiversity metrics.',
    targetDistricts: ['Mukono (Nama / Nakisunga / Goma)'],
    targetEcologicalZones: ['Lake Victoria Crescent'],
    totalSeedlingsFunded: 250000,
    seedlingsClaimed: 187500,
    maxPerFarmer: 500,
    eligibleSpecies: [
      'African Teak (Milicia excelsa)',
      'Mahogany (Khaya anthotheca)',
      'Red Stinkwood (Prunus africana)'
    ],
    requirements: [
      'Proof of land tenure in Mukono District (> 0.5 acres)',
      'Pledge to maintain 3-year survival monitoring records'
    ],
    deadline: '2026-11-30',
    status: 'Active & Accepting Applications',
    partnerNurseryIds: ['green-canopy-mukono', 'ecoroots-hub-mukono']
  },
  {
    id: 'carbon-agroforestry-mukono',
    title: 'Carbon Agroforestry',
    sponsorName: 'ACORN (Rabobank) & Tree Adoption Uganda',
    sponsorType: 'NGO',
    logoType: 'leaf',
    description: 'Support for farmers integrating fruit and timber trees into agricultural landscapes to generate additional carbon revenue.',
    targetDistricts: ['Mukono (Kyampisi / Mpatta / Nakisunga)'],
    targetEcologicalZones: ['Lake Victoria Crescent'],
    totalSeedlingsFunded: 150000,
    seedlingsClaimed: 63000,
    maxPerFarmer: 250,
    eligibleSpecies: [
      'Grevillea Robusta',
      'African Teak (Milicia excelsa)',
      'Grafted Avocado'
    ],
    requirements: [
      'Active coffee, banana, or agroforestry farm in Mukono',
      'Mobile Money registration for annual carbon dividend payouts'
    ],
    deadline: '2026-12-15',
    status: 'Active & Accepting Applications',
    partnerNurseryIds: ['green-canopy-mukono', 'ecoroots-hub-mukono']
  }
];
