import type { FunderType } from '@nurserylink/shared';
import { Badge } from '@nurserylink/ui';
import { en } from '../../copy/en';

/** Who pays for the campaign: government, NGO, foundation or company. */
export const FunderBadge = ({ type }: { type: FunderType }) => <Badge tone="neutral">{en.freeSeedlings.funder[type]}</Badge>;
