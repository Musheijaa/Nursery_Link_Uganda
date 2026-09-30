import { DistrictDemand, ForestLossArea } from './types.js';

// Illustrative figures for the demo. The drivers reflect widely reported pressures,
// but the hectare and demand numbers are not survey data.

export const FOREST_LOSS_AREAS: ForestLossArea[] = [
  {
    id: 'mabira-edge',
    name: 'Mabira Forest edge',
    district: 'Buikwe',
    coordinates: [0.4300, 33.0000],
    radiusKm: 9,
    forestLossHa: 1200,
    drivers: ['Sugarcane expansion', 'Firewood and charcoal', 'Encroachment for farming'],
    recommendedSpeciesIds: ['mvule', 'musizi', 'mahogany'],
  },
  {
    id: 'bugoma',
    name: 'Bugoma Forest area',
    district: 'Kikuube',
    coordinates: [1.2500, 30.9700],
    radiusKm: 12,
    forestLossHa: 2500,
    drivers: ['Sugarcane plantations', 'Settlement', 'Timber harvesting'],
    recommendedSpeciesIds: ['mahogany', 'mvule', 'musizi'],
  },
  {
    id: 'nwoya-amuru',
    name: 'Nwoya–Amuru charcoal belt',
    district: 'Nwoya',
    coordinates: [2.6000, 32.0000],
    radiusKm: 18,
    forestLossHa: 4800,
    drivers: ['Commercial charcoal burning', 'Large-scale farm clearing'],
    recommendedSpeciesIds: ['shea', 'mvule', 'mango'],
  },
  {
    id: 'elgon-slopes',
    name: 'Lower slopes of Mt Elgon',
    district: 'Bududa',
    coordinates: [1.0200, 34.3300],
    radiusKm: 8,
    forestLossHa: 900,
    drivers: ['Cultivation on steep slopes', 'Landslide damage', 'Firewood collection'],
    recommendedSpeciesIds: ['grevillea', 'prunus', 'mukebu'],
  },
];

export const DISTRICT_DEMAND: DistrictDemand[] = [
  { district: 'Nwoya', annualDemand: 400000, forestLossHa: 4800 },
  { district: 'Kikuube', annualDemand: 350000, forestLossHa: 2500 },
  { district: 'Gulu', annualDemand: 300000, forestLossHa: 2100 },
  { district: 'Buikwe', annualDemand: 250000, forestLossHa: 1200 },
  { district: 'Hoima', annualDemand: 250000, forestLossHa: 1600 },
  { district: 'Arua', annualDemand: 220000, forestLossHa: 1400 },
  { district: 'Bududa', annualDemand: 180000, forestLossHa: 900 },
  { district: 'Lira', annualDemand: 180000, forestLossHa: 1100 },
  { district: 'Mukono', annualDemand: 200000, forestLossHa: 800 },
  { district: 'Kabale', annualDemand: 150000, forestLossHa: 500 },
  { district: 'Mbale', annualDemand: 150000, forestLossHa: 700 },
  { district: 'Masaka', annualDemand: 120000, forestLossHa: 450 },
];
