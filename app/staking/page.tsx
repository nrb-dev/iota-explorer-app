import type { Metadata } from 'next';

import { StakingPageClient } from '@/components/staking/staking-page-client';

export const metadata: Metadata = {
  title: 'IOTA Staking',
  description:
    'Compare IOTA validator pools, APY, commission, stake concentration, and estimated staking rewards.',
};

export default function Staking() {
  return <StakingPageClient />;
}
