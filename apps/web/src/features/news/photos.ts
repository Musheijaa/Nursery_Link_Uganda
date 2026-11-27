import { CloudSun, GraduationCap, HandCoins, Landmark, Newspaper, Sprout, Wheat, type LucideIcon } from 'lucide-react';
import { IMAGES } from '../../data/images';

/** A photo per category for posts without their own cover, so every post has a picture. */
const CATEGORY_PHOTO: Record<string, keyof typeof IMAGES> = {
  'policy-sector': 'mabira-forest',
  'weather-seasonal': 'community-planting',
  'planting-restoration': 'nurseryman-kapchorwa',
  'agroforestry-farming': 'agroforestry-masaka',
  'training-events': 'hero-nursery-beds',
  'funding-partnerships': 'seedlings-offloading',
};

export const postPhoto = (post: { category: { slug: string }; cover_url?: string | null }): string =>
  post.cover_url ?? IMAGES[CATEGORY_PHOTO[post.category.slug] ?? 'western-hills']?.src ?? '';

/** An icon for each News & Updates category (chips and headers); categories added later get a newspaper */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  'policy-sector': Landmark,
  'weather-seasonal': CloudSun,
  'planting-restoration': Sprout,
  'agroforestry-farming': Wheat,
  'training-events': GraduationCap,
  'funding-partnerships': HandCoins,
};
export const categoryIcon = (slug: string): LucideIcon => CATEGORY_ICON[slug] ?? Newspaper;
