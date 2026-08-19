import { DeforestationHotspot, DistrictShadowDeficit } from '../types';

export const DEFORESTATION_HOTSPOTS: DeforestationHotspot[] = [
  {
    id: 'hotspot-mabira-mukono-fringe',
    name: 'Mabira Reserve Western Fringe Encroachment Zone',
    district: 'Mukono (Nama / Nakisunga)',
    coordinates: [0.3950, 32.8240],
    radiusKm: 7.5,
    forestLossHectaresPast3Yrs: 3850,
    primaryDrivers: ['Illegal brick firing furnaces', 'Firewood supply for urban bakeries & factories', 'Smallholder sugarcane boundary expansion'],
    nearestNurseryDistanceKm: 4.8,
    priorityScore: 92,
    recommendedSpecies: ['Milicia excelsa (Mvule)', 'Khaya anthotheca (Mahogany)', 'Maesopsis eminii (Musizi)', 'Markhamia lutea']
  },
  {
    id: 'hotspot-katosi-lakeshore-degradation',
    name: 'Lake Victoria Katosi Shoreline Wetland & Woodland Buffer Loss',
    district: 'Mukono (Mpatta / Mpunge)',
    coordinates: [0.1380, 32.8120],
    radiusKm: 6.0,
    forestLossHectaresPast3Yrs: 2400,
    primaryDrivers: ['Fish-smoking kiln fuelwood extraction', 'Sand mining lakefront clearing', 'Unregulated settlement expansion'],
    nearestNurseryDistanceKm: 3.2,
    priorityScore: 88,
    recommendedSpecies: ['African Lowland Solid Bamboo', 'Moringa oleifera', 'Markhamia lutea', 'Albizia coriaria']
  },
  {
    id: 'hotspot-kyampisi-kasawo-woodlot-gap',
    name: 'Kyampisi-Kasawo Agricultural Woodlot Deficit Zone',
    district: 'Mukono (Kyampisi / Kasawo)',
    coordinates: [0.5200, 32.7950],
    radiusKm: 8.0,
    forestLossHectaresPast3Yrs: 2900,
    primaryDrivers: ['Intensive land sub-division for subsistence maize/cassava', 'Charcoal burning on private mailo land'],
    nearestNurseryDistanceKm: 6.5,
    priorityScore: 85,
    recommendedSpecies: ['Albizia coriaria (Mugavu)', 'Grafted Hass Avocado', 'Macadamia Nut', 'Silky Oak (Grevillea)']
  },
  {
    id: 'hotspot-seeta-goma-urban-pressure',
    name: 'Goma-Seeta Rapid Urbanization & Peri-Urban Tree Loss',
    district: 'Mukono (Goma Sub-County)',
    coordinates: [0.3750, 32.7100],
    radiusKm: 5.0,
    forestLossHectaresPast3Yrs: 1800,
    primaryDrivers: ['Real estate residential sprawl', 'Loss of indigenous shade trees in home gardens'],
    nearestNurseryDistanceKm: 2.1,
    priorityScore: 78,
    recommendedSpecies: ['Persea americana (Grafted Avocado)', 'Cordia africana', 'Markhamia lutea', 'Musizi']
  }
];

export const DISTRICT_SHADOW_DEFICITS: DistrictShadowDeficit[] = [
  {
    district: 'Mukono (Nakisunga Sub-County)',
    region: 'Central',
    forestCoverLossHectares: 1950,
    activeNurseriesCount: 1,
    annualSeedlingDeficit: 240000,
    opportunityScore: 92,
    recommendedNurseryCapacity: 500000,
    coordinates: [0.2980, 32.7845]
  },
  {
    district: 'Mukono (Mpatta & Katosi Shores)',
    region: 'Central',
    forestCoverLossHectares: 1650,
    activeNurseriesCount: 1,
    annualSeedlingDeficit: 190000,
    opportunityScore: 88,
    recommendedNurseryCapacity: 400000,
    coordinates: [0.1510, 32.7980]
  },
  {
    district: 'Mukono (Kyampisi & Kasawo Belt)',
    region: 'Central',
    forestCoverLossHectares: 1400,
    activeNurseriesCount: 2,
    annualSeedlingDeficit: 160000,
    opportunityScore: 85,
    recommendedNurseryCapacity: 350000,
    coordinates: [0.4420, 32.7710]
  },
  {
    district: 'Mukono (Goma & Seeta Peri-Urban)',
    region: 'Central',
    forestCoverLossHectares: 1100,
    activeNurseriesCount: 1,
    annualSeedlingDeficit: 120000,
    opportunityScore: 78,
    recommendedNurseryCapacity: 300000,
    coordinates: [0.3842, 32.7218]
  },
  {
    district: 'Mukono (Nama & Kasangalabi)',
    region: 'Central',
    forestCoverLossHectares: 950,
    activeNurseriesCount: 1,
    annualSeedlingDeficit: 90000,
    opportunityScore: 70,
    recommendedNurseryCapacity: 1000000,
    coordinates: [0.3542, 32.7538]
  }
];
