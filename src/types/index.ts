// Shapes returned by the Nursery Link API (see server/src/routes).

export type Region = 'Central' | 'Eastern' | 'Northern' | 'Western';

export interface District {
  name: string;
  region: Region;
  coordinates: [number, number];
}

export type SpeciesCategory =
  | 'Indigenous timber'
  | 'Fast-growing timber'
  | 'Fruit tree'
  | 'Shade & agroforestry'
  | 'Medicinal & cultural';

export interface TreeSpecies {
  id: string;
  commonName: string;
  botanicalName: string;
  localNames: { language: string; name: string }[];
  category: SpeciesCategory;
  isNative: boolean;
  description: string;
  uses: string[];
  regions: Region[];
  altitudeM: [number, number];
  growthRate: 'Fast' | 'Moderate' | 'Slow';
  timeToHarvest: string;
  plantingTip: string;
  /** Key into src/data/images.ts */
  image: string;
  nurseryCount: number;
  lowestPriceUGX: number | null;
}

export type SeedlingType = 'Potted seedling' | 'Root trainer' | 'Grafted' | 'Cutting';

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

export type Registration = 'NFA registered' | 'MAAIF certified' | 'District registered' | 'Community group';
export type DeliveryMethod = 'Collect from nursery' | 'Boda boda' | 'Truck';
export type PaymentNetwork = 'MTN MoMo' | 'Airtel Money';

export interface Nursery {
  id: string;
  slug: string;
  name: string;
  operatorName: string;
  phone: string;
  district: string;
  region: Region;
  subCounty: string;
  village: string;
  coordinates: [number, number];
  registration: Registration;
  registrationNumber: string;
  established: number;
  description: string;
  deliveryMethods: DeliveryMethod[];
  openingHours: string;
  status: 'pending' | 'active' | 'suspended';
  distanceKm: number | null;
  batches: SeedlingBatch[];
}

export interface ManagedNursery extends Nursery {
  payoutPhone: string;
  payoutNetwork: PaymentNetwork;
  stats: { openOrders: number; heldUGX: number; paidUGX: number };
}

export interface DeliveryQuote {
  method: DeliveryMethod;
  available: boolean;
  feeUGX: number;
  distanceKm: number;
  note: string;
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'payment_failed'
  | 'payment_held'
  | 'being_prepared'
  | 'on_the_way'
  | 'delivered'
  | 'problem_reported'
  | 'cancelled';

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  nursery: { id: string; name: string; phone: string; district: string };
  buyer: { name: string; phone: string };
  deliveryMethod: DeliveryMethod;
  deliveryDistrict: string;
  deliveryArea: string;
  deliveryLandmark: string;
  distanceKm: number;
  items: { speciesId: string; speciesName: string; seedlingType: SeedlingType; quantity: number; unitPriceUGX: number }[];
  seedlingsTotalUGX: number;
  deliveryFeeUGX: number;
  totalUGX: number;
  payment: { status: 'pending' | 'successful' | 'failed'; network: PaymentNetwork; phone: string; failureReason: string | null } | null;
  payout: { status: 'pending' | 'successful' | 'failed'; amountUGX: number } | null;
  events: { status: OrderStatus; at: string; note: string | null }[];
  /** Only present for the buyer, once the order is paid */
  deliveryCode?: string;
}

export interface SeedlingProgramme {
  id: string;
  title: string;
  sponsorName: string;
  sponsorType: 'NGO' | 'Company' | 'Community organisation' | 'Government';
  description: string;
  /** Empty means open to applicants in any district */
  districts: string[];
  speciesIds: string[];
  maxPerApplicant: number;
  totalSeedlings: number;
  seedlingsClaimed: number;
  requirements: string[];
  deadline: string;
  status: 'Open' | 'Opening soon' | 'Closed';
  collectionNurseries: { id: string; name: string; district: string }[];
}

export interface Voucher {
  code: string;
  programmeId: string;
  seedlings: number;
  status: 'issued' | 'redeemed' | 'cancelled';
  issuedAt: string;
  redeemedAt: string | null;
  district: string;
}

export interface PlantingGaps {
  isIllustrative: boolean;
  districts: {
    district: string;
    region: Region;
    annualDemand: number;
    forestLossHa: number;
    nurseryCount: number;
    supply: number;
    coveragePercent: number;
  }[];
  areas: {
    id: string;
    name: string;
    district: string;
    coordinates: [number, number];
    radiusKm: number;
    forestLossHa: number;
    drivers: string[];
    recommendedSpeciesIds: string[];
    nearestNursery: { name: string; distanceKm: number } | null;
  }[];
}

export interface SiteStats {
  nurseries: number;
  districts: number;
  species: number;
  seedlingsInStock: number;
}

export type Role = 'buyer' | 'nursery_owner' | 'admin';

export interface User {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
}

export interface AdminOverview {
  pendingNurseries: number;
  disputes: number;
  failedPayouts: number;
  orders30d: number;
  sales30dUGX: number;
  heldUGX: number;
}
