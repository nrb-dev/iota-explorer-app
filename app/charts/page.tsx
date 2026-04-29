import type { Metadata } from 'next';

import { ChartsPageClient } from '@/components/charts/charts-page-client';

export const metadata: Metadata = {
  title: 'IOTA Network Charts',
  description:
    'Explore IOTA network activity, usage, and economics charts across recent epochs.',
};

export default function Charts() {
  return <ChartsPageClient />;
}
