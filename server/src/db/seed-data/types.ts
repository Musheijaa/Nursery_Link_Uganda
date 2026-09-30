// Shapes of the sample data used by the seed script.

export type Region = 'Central' | 'Eastern' | 'Northern' | 'Western';
export type SeedlingType = 'Potted seedling' | 'Root trainer' | 'Grafted' | 'Cutting';
export type DeliveryMethod = 'Collect from nursery' | 'Boda boda' | 'Truck';
export type Registration = 'NFA registered' | 'MAAIF certified' | 'District registered' | 'Community group';

export interface District { name: string; region: Region; coordinates: [number, number] }

export interface TreeSpecies {
  id: string;
  commonName: string;
  botanicalName: string;
  localNames: { language: string; name: string }[];
  category: 'Indigenous timber' | 'Fast-growing timber' | 'Fruit tree' | 'Shade & agroforestry' | 'Medicinal & cultural';
  isNative: boolean;
  description: string;
  uses: string[];
  regions: Region[];
  altitudeM: [number, number];
  growthRate: 'Fast' | 'Moderate' | 'Slow';
  timeToHarvest: string;
  plantingTip: string;
  image: string;
}

export interface SeedlingBatch {
  id: string;
  speciesId: string;
  seedlingType: SeedlingType;
  ageMonths: number;
  heightCm: number;
  unitPriceUGX: number;
  quantityAvailable: number;
  status: 'Ready' | 'Ready soon';
}

export interface Nursery {
  id: string;
  name: string;
  operatorName: string;
  phone: string;
  district: string;
  subCounty: string;
  village: string;
  region: Region;
  coordinates: [number, number];
  registration: Registration;
  registrationNumber: string;
  established: number;
  description: string;
  deliveryMethods: DeliveryMethod[];
  openingHours: string;
  batches: SeedlingBatch[];
}

export interface SeedlingProgramme {
  id: string;
  title: string;
  sponsorName: string;
  sponsorType: 'NGO' | 'Company' | 'Community organisation';
  description: string;
  districts: string[];
  speciesIds: string[];
  maxPerApplicant: number;
  totalSeedlings: number;
  seedlingsClaimed: number;
  requirements: string[];
  deadline: string;
  status: 'Open' | 'Opening soon';
  collectionNurseryIds: string[];
}

export interface ForestLossArea {
  id: string;
  name: string;
  district: string;
  coordinates: [number, number];
  radiusKm: number;
  forestLossHa: number;
  drivers: string[];
  recommendedSpeciesIds: string[];
}

export interface DistrictDemand { district: string; annualDemand: number; forestLossHa: number }
