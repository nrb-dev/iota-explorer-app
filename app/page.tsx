'use client';

import { Globe } from '@/components/globe';
import { useValidators } from '@/components/globe';
import { ValidatorTable } from '@/components/validator-table';

export default function Home() {
  const { validators, epoch, totalStake, isLoading } = useValidators();
  return (
    <main className="relative">
      <Globe validators={validators} isLoading={isLoading} />
      <ValidatorTable
        validators={validators}
        epoch={epoch}
        totalStake={totalStake}
        isLoading={isLoading}
      />
    </main>
  );
}
