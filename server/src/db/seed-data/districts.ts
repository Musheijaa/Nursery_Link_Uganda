import { District } from './types.js';

// Districts served by listed nurseries or covered by planting-gap data.
// Coordinates are approximate town centres, used to estimate delivery distance.
export const DISTRICTS: District[] = [
  { name: 'Kampala', region: 'Central', coordinates: [0.3476, 32.5825] },
  { name: 'Wakiso', region: 'Central', coordinates: [0.4044, 32.4594] },
  { name: 'Mukono', region: 'Central', coordinates: [0.3533, 32.7553] },
  { name: 'Buikwe', region: 'Central', coordinates: [0.3375, 33.0106] },
  { name: 'Masaka', region: 'Central', coordinates: [-0.3338, 31.7341] },
  { name: 'Jinja', region: 'Eastern', coordinates: [0.4244, 33.2042] },
  { name: 'Mbale', region: 'Eastern', coordinates: [1.0827, 34.1750] },
  { name: 'Bududa', region: 'Eastern', coordinates: [1.0106, 34.3319] },
  { name: 'Kapchorwa', region: 'Eastern', coordinates: [1.3960, 34.4509] },
  { name: 'Gulu', region: 'Northern', coordinates: [2.7724, 32.2881] },
  { name: 'Nwoya', region: 'Northern', coordinates: [2.6340, 32.0020] },
  { name: 'Lira', region: 'Northern', coordinates: [2.2499, 32.8999] },
  { name: 'Arua', region: 'Northern', coordinates: [3.0201, 30.9111] },
  { name: 'Hoima', region: 'Western', coordinates: [1.4331, 31.3524] },
  { name: 'Kikuube', region: 'Western', coordinates: [1.2000, 31.0700] },
  { name: 'Kabarole', region: 'Western', coordinates: [0.6710, 30.2750] },
  { name: 'Mbarara', region: 'Western', coordinates: [-0.6072, 30.6545] },
  { name: 'Kabale', region: 'Western', coordinates: [-1.2486, 29.9899] },
];

