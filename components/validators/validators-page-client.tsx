'use client';

import { AlertCircle } from 'lucide-react';

import { useValidators } from '@/components/globe';
import { Card, CardContent } from '@/components/ui/card';
import { ValidatorTable } from '@/components/validator-table';
import { useNetworkStore } from '@/lib/network-store';

export function ValidatorsPageClient() {
  const network = useNetworkStore((state) => state.network);
  const { validators, epoch, totalStake, isLoading, error } = useValidators();

  return (
    <main className="relative min-h-screen pt-28">
      <section className="mx-auto w-full max-w-7xl px-4 pb-8">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-primary">IOTA validators</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
            Delegate with live validator context
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Compare stake, APY, commission, voting power concentration, and
            geographic distribution from the selected IOTA validator set.
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Active network: {network}
          </p>
        </div>
      </section>

      {error && !isLoading && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-6">
          <Card className="border-destructive/30 bg-destructive/10">
            <CardContent className="flex items-center gap-3 py-1 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                Validator refresh failed. Showing cached data when available.
              </span>
            </CardContent>
          </Card>
        </section>
      )}

      <ValidatorTable
        validators={validators}
        epoch={epoch}
        totalStake={totalStake}
        isLoading={isLoading}
      />
    </main>
  );
}
