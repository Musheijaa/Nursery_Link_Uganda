import type { NewsCategory } from '@nurserylink/shared';
import { IMAGES } from '../../data/images';

/** A photo per category for posts without their own cover, so every post has a picture. */
const CATEGORY_PHOTO: Record<NewsCategory, keyof typeof IMAGES> = {
  weather: 'community-planting',
  market: 'seedlings-offloading',
  policy: 'mabira-forest',
  grant: 'nurseryman-kapchorwa',
};

export const postPhoto = (post: { category: NewsCategory; cover_url?: string | null }): string =>
  post.cover_url ?? IMAGES[CATEGORY_PHOTO[post.category]]?.src ?? '';
