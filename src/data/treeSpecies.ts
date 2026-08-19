import { TreeSpecies } from '../types';

export const TREE_SPECIES: TreeSpecies[] = [
  {
    id: 'mvule-milicia-excelsa',
    botanicalName: 'Milicia excelsa',
    commonName: 'African Teak',
    localNames: {
      'Luganda': 'Mvule',
      'Lusoga': 'Mvule',
      'Luo': 'Olwa'
    },
    category: 'Indigenous Hardwood',
    description: 'A highly valued timber species, vital for ecological restoration in humid savanna regions. Supports massive biodiversity and long-term carbon sink capacity.',
    benefits: [
      'Top-tier high-value durable noble timber',
      'Deep taproot stabilizes catchment soil against erosion',
      'Excellent bird nesting canopy & pollinator attraction'
    ],
    ecologicalZones: ['Lake Victoria Crescent', 'Central Savannah', 'Albertine Rift'],
    elevationRangeMeters: [700, 1400],
    annualRainfallMm: [1000, 1800],
    growthRate: 'Moderate',
    waterNeed: 'High',
    isNative: true,
    maturityYears: 30,
    carbonSequestrationKgPerYear: 38.5,
    agroforestryCompatibility: 4,
    soilTypes: ['Deep fertile clay-loams', 'Volcanic soils', 'Alluvial sands'],
    timberValueGrade: 'A+ High Luxury',
    image: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'prunus-africana',
    botanicalName: 'Prunus africana',
    commonName: 'Red Stinkwood',
    localNames: {
      'Luganda': 'Ntasesa',
      'Rukiga': 'Omumba',
      'Lugisu': 'Chirurwe'
    },
    category: 'Medicinal & Botanical',
    description: 'Crucial high-altitude forest tree known for its medicinal bark. Highly prioritized for watershed buffer protection and conservation.',
    benefits: [
      'High-value medicinal bark for export and traditional pharmacy',
      'Superb soil water catchment retention in highland slopes',
      'Crucial food source for montane birds and primates'
    ],
    ecologicalZones: ['Mt. Elgon Highlands', 'South-Western Highlands', 'Albertine Rift'],
    elevationRangeMeters: [1500, 2800],
    annualRainfallMm: [1200, 2400],
    growthRate: 'Slow',
    waterNeed: 'Medium',
    isNative: true,
    maturityYears: 18,
    carbonSequestrationKgPerYear: 32.0,
    agroforestryCompatibility: 4,
    soilTypes: ['Volcanic humic loams', 'Well-drained acidic soils'],
    timberValueGrade: 'A Commercial',
    image: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'khaya-anthotheca',
    botanicalName: 'Khaya anthotheca',
    commonName: 'Mahogany',
    localNames: {
      'Luganda': 'Munyama',
      'Runyoro': 'Munyama',
      'Acholi': 'Eri'
    },
    category: 'Indigenous Hardwood',
    description: 'A fast-growing, large canopy tree ideal for rapid reforestation of degraded lands and providing dense timber biomass.',
    benefits: [
      'Supreme quality cabinet and export-grade timber',
      'Massive carbon sink biomass capability',
      'Provides vital shade corridor in agro-corridors'
    ],
    ecologicalZones: ['Albertine Rift', 'Lake Victoria Crescent'],
    elevationRangeMeters: [900, 1600],
    annualRainfallMm: [1200, 2000],
    growthRate: 'Fast',
    waterNeed: 'Medium',
    isNative: false, // Compatible / cultivated status
    maturityYears: 25,
    carbonSequestrationKgPerYear: 42.0,
    agroforestryCompatibility: 3,
    soilTypes: ['Deep loamy soils', 'Moist well-drained forest soils'],
    timberValueGrade: 'A+ High Luxury',
    image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'eucalyptus-grandis',
    botanicalName: 'Eucalyptus grandis',
    commonName: 'Eucalyptus Grandis',
    localNames: {
      'Luganda': 'Kalitunsi'
    },
    category: 'Fast-Growing Timber',
    description: 'Ultra-fast utility timber and transmission pole species with high commercial woodlot returns.',
    benefits: [
      'Rapid rotation harvest in 6-8 years',
      'Straight utility poles for rural electrification'
    ],
    ecologicalZones: ['Lake Victoria Crescent', 'Central Savannah'],
    elevationRangeMeters: [1000, 2000],
    annualRainfallMm: [1000, 1800],
    growthRate: 'Fast',
    waterNeed: 'High',
    isNative: false,
    maturityYears: 8,
    carbonSequestrationKgPerYear: 35.0,
    agroforestryCompatibility: 2,
    soilTypes: ['Deep fertile soils'],
    timberValueGrade: 'B Utility',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'pinus-caribaea',
    botanicalName: 'Pinus caribaea',
    commonName: 'Pinus Caribaea',
    localNames: {
      'Luganda': 'Payini'
    },
    category: 'Fast-Growing Timber',
    description: 'Commercial sawlog pine tree that produces structural building timber and pulp.',
    benefits: [
      'Resistant to dry spells',
      'High-grade commercial timber boards'
    ],
    ecologicalZones: ['Lake Victoria Crescent', 'Albertine Rift'],
    elevationRangeMeters: [800, 1800],
    annualRainfallMm: [900, 1600],
    growthRate: 'Fast',
    waterNeed: 'Low',
    isNative: false,
    maturityYears: 15,
    carbonSequestrationKgPerYear: 30.0,
    agroforestryCompatibility: 2,
    soilTypes: ['Sandy loams'],
    timberValueGrade: 'A Commercial',
    image: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'grevillea-robusta',
    botanicalName: 'Grevillea robusta',
    commonName: 'Grevillea Robusta',
    localNames: {
      'Luganda': 'Grevilia'
    },
    category: 'Fast-Growing Timber',
    description: 'Deep vertical rooting agroforestry tree ideal for farm boundaries, windbreaks, and coffee shade.',
    benefits: [
      'Does not compete with shallow crop roots',
      'Excellent bee forage and mulching leaf litter'
    ],
    ecologicalZones: ['Lake Victoria Crescent', 'Mt. Elgon Highlands'],
    elevationRangeMeters: [1000, 2200],
    annualRainfallMm: [900, 1800],
    growthRate: 'Fast',
    waterNeed: 'Medium',
    isNative: false,
    maturityYears: 10,
    carbonSequestrationKgPerYear: 28.0,
    agroforestryCompatibility: 5,
    soilTypes: ['Well-drained soils'],
    timberValueGrade: 'A Commercial',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'
  }
];
