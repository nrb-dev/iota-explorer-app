'use client';

import { Globe } from '@/components/globe';
import { useValidators } from '@/components/globe';
import { HomeInsights } from '@/components/home/home-insights';

export default function Home() {
  const { validators, isLoading, error } = useValidators();
  return (
    <main className="relative">
      <Globe validators={validators} isLoading={isLoading} error={error} />
      <HomeInsights className="-top-20" />
    </main>
  );
}
