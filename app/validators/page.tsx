import type { Metadata } from 'next';

import { ValidatorsPageClient } from '@/components/validators/validators-page-client';

export const metadata: Metadata = {
  title: 'IOTA Validators',
  description:
    'Compare active IOTA validators by stake, APY, commission, voting power, and geography.',
};

export default function Validators() {
  return <ValidatorsPageClient />;
}
