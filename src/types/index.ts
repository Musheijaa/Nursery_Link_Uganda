export type EcologicalZone = 
  | 'Lake Victoria Crescent'
  | 'Albertine Rift'
  | 'Mt. Elgon Highlands'
  | 'South-Western Highlands'
  | 'Northern Grasslands'
  | 'Central Savannah'
  | 'West Nile Plateau'
  | 'Karamoja Semi-Arid';

export type CertificationLevel = 
  | 'NFA Certified (National Forest Authority)'
  | 'MAAIF Verified (Ministry of Agriculture)'
  | 'Community Seedling Producer'
  | 'Carbon Standard Audited (Plan Vivo / Gold Standard)';

export type SpeciesCategory = 
  | 'Indigenous Hardwood'
  | 'Fast-Growing Timber'
  | 'High-Value Fruit & Nut'
  | 'Agroforestry & Soil Fertility'
  | 'Medicinal & Botanical'
  | 'Bamboo & Biomass';

export type PottingType = 'Poly-tube Potted' | 'Bare-Root Seedling' | 'Root-Trainer Plug' | 'Grafted Bare-Root' | 'Potted Clonal Cutting';

export interface TreeSpecies {
  id: string;
  botanicalName: string;
  commonName: string;
  localNames: { [language: string]: string };
  category: SpeciesCategory;
  description: string;
  benefits: string[];
  ecologicalZones: EcologicalZone[];
  elevationRangeMeters: [number, number];
  annualRainfallMm: [number, number];
  growthRate: 'Fast' | 'Moderate' | 'Slow';
  waterNeed: 'Low' | 'Medium' | 'High';
  isNative: boolean;
  maturityYears: number;
  carbonSequestrationKgPerYear: number;
  agroforestryCompatibility: 1 | 2 | 3 | 4 | 5;
  soilTypes: string[];
  timberValueGrade: 'A+ High Luxury' | 'A Commercial' | 'B Utility' | 'Fuelwood / Non-timber';
  image: string;
}

export interface SeedlingBatch {
  id: string;
  speciesId: string;
  speciesName: string;
  botanicalName: string;
  category: SpeciesCategory;
  pottingType: PottingType;
  ageMonths: number;
  heightCm: number;
  germinationRatePercent: number;
  unitPriceUGX: number;
  quantityAvailable: number;
  batchCode: string;
  status: 'Verified' | 'Pending' | 'Audited';
  escrowCommitmentPercent: number;
  certifiedMotherTree: boolean;
  readyForPlanting: boolean;
}

export interface Nursery {
  id: string;
  name: string;
  zone: string;
  operatorName: string;
  phone: string;
  email: string;
  district: string;
  subCounty: string;
  village: string;
  coordinates: [number, number];
  elevationMeters: number;
  certification: CertificationLevel;
  accreditationNumber: string;
  ecologicalZone: EcologicalZone;
  annualCapacity: number;
  currentStockTotal: number;
  rating: number;
  reviewsCount: number;
  waterSource: 'Gravity Piped' | 'Borehole' | 'River/Stream' | 'Rainwater Harvesting Reservoir';
  specialties: string[];
  batches: SeedlingBatch[];
  photos: string[];
  verifiedSince: string;
}

export interface CartItem {
  nurseryId: string;
  nurseryName: string;
  nurseryCoordinates: [number, number];
  nurseryDistrict: string;
  batch: SeedlingBatch;
  quantity: number;
}

export type EscrowStatus = 
  | 'Awaiting Payment'
  | 'Escrow Funded'
  | 'Batch Preparation'
  | 'In Transit'
  | 'Delivered - Inspection Period'
  | 'Released to Nursery'
  | 'Dispute Raised';

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  buyerName: string;
  buyerPhone: string;
  deliveryDistrict: string;
  deliverySubCounty: string;
  deliveryCoordinates: [number, number];
  distanceKm: number;
  nurseryId: string;
  nurseryName: string;
  items: {
    speciesName: string;
    botanicalName: string;
    quantity: number;
    unitPriceUGX: number;
    pottingType: string;
  }[];
  seedlingSubtotalUGX: number;
  deliveryFeeUGX: number;
  totalAmountUGX: number;
  paymentMethod: 'MTN Mobile Money' | 'Airtel Money';
  momoNumber: string;
  momoTransactionRef: string;
  escrowStatus: EscrowStatus;
  escrowReleasePin: string;
  driverName?: string;
  driverPhone?: string;
  vehicleType?: string;
  estimatedDeliveryDate: string;
  plantingGuideDownloaded: boolean;
}

export interface FreeCampaign {
  id: string;
  title: string;
  sponsorName: string;
  sponsorType: 'Local Gov' | 'NGO' | 'Carbon Project' | 'Corporate CSR';
  logoType: 'tree' | 'leaf' | 'shield';
  description: string;
  targetDistricts: string[];
  targetEcologicalZones: EcologicalZone[];
  totalSeedlingsFunded: number;
  seedlingsClaimed: number;
  maxPerFarmer: number;
  eligibleSpecies: string[];
  requirements: string[];
  deadline: string;
  status: 'Active & Accepting Applications' | 'Quota Full' | 'Coming Soon';
  partnerNurseryIds: string[];
}

export interface DeforestationHotspot {
  id: string;
  name: string;
  district: string;
  coordinates: [number, number];
  radiusKm: number;
  forestLossHectaresPast3Yrs: number;
  primaryDrivers: string[];
  nearestNurseryDistanceKm: number;
  priorityScore: number;
  recommendedSpecies: string[];
}

export interface DistrictShadowDeficit {
  district: string;
  region: 'Central' | 'Eastern' | 'Western' | 'Northern';
  forestCoverLossHectares: number;
  activeNurseriesCount: number;
  annualSeedlingDeficit: number;
  opportunityScore: number;
  recommendedNurseryCapacity: number;
  coordinates: [number, number];
}
