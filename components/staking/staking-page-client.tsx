'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Calculator,
  Coins,
  Gauge,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';

import { useValidators } from '@/components/globe';
import type { Validator } from '@/components/globe/types';
import { MetricCard } from '@/components/metric-card';
import { PageShell } from '@/components/page-shell';
import { ValidatorAvatar } from '@/components/validators/validator-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  formatApy,
  formatCommission,
  formatIota,
  formatVotingPower,
} from '@/lib/formatters';
import { useNetworkStore, withNetworkParam } from '@/lib/network-store';

const DELEGATION_PRESETS = [1_000, 10_000, 100_000] as const;
const TOP_VALIDATORS_COUNT = 8;

function numericStake(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function getAverageApy(validators: Validator[]): number | null {
  const withApy = validators.filter((validator) => validator.apy != null);
  if (withApy.length === 0) return null;
  return (
    withApy.reduce((sum, validator) => sum + (validator.apy ?? 0), 0) /
    withApy.length
  );
}

function getMedianApy(validators: Validator[]): number | null {
  const apys = validators
    .map((validator) => validator.apy)
    .filter((apy): apy is number => apy != null)
    .sort((a, b) => a - b);
  if (apys.length === 0) return null;
  const midpoint = Math.floor(apys.length / 2);
  return apys.length % 2 === 0
    ? (apys[midpoint - 1] + apys[midpoint]) / 2
    : apys[midpoint];
}

function getAverageCommission(validators: Validator[]): number | null {
  if (validators.length === 0) return null;
  return (
    validators.reduce((sum, validator) => sum + validator.commissionRate, 0) /
    validators.length
  );
}

function formatIotaAmount(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value.toFixed(2)}%`;
}

function ValidatorRow({
  validator,
  totalVotingPower,
  totalStake,
  rank,
  onOpen,
}: {
  validator: Validator;
  totalVotingPower: number;
  totalStake: number;
  rank: number;
  onOpen: (address: string) => void;
}) {
  const stake = numericStake(validator.stakingPoolIotaBalance);
  const stakeShare = totalStake > 0 ? (stake / totalStake) * 100 : 0;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/40"
      tabIndex={0}
      role="button"
      onClick={() => onOpen(validator.iotaAddress)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(validator.iotaAddress);
        }
      }}
    >
      <TableCell className="w-10 text-center font-mono text-xs text-muted-foreground">
        {rank}
      </TableCell>
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <ValidatorAvatar
            name={validator.name}
            imageUrl={validator.imageUrl}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{validator.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {validator.city}, {validator.country}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatIota(validator.stakingPoolIotaBalance)} IOTA
      </TableCell>
      <TableCell className="hidden text-right font-mono sm:table-cell">
        {formatApy(validator.apy)}
      </TableCell>
      <TableCell className="hidden text-right font-mono md:table-cell">
        {formatCommission(validator.commissionRate)}
      </TableCell>
      <TableCell className="hidden text-right font-mono lg:table-cell">
        {formatVotingPower(validator.votingPower, totalVotingPower)}
      </TableCell>
      <TableCell className="hidden text-right lg:table-cell">
        <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, stakeShare)}%` }}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function StakingSkeleton() {
  return (
    <PageShell>
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </PageShell>
  );
}

export function StakingPageClient() {
  const router = useRouter();
  const selectedNetwork = useNetworkStore((state) => state.network);
  const { validators, epoch, totalStake, network, isLoading, error } =
    useValidators();
  const [delegationAmount, setDelegationAmount] = useState('10000');

  const totalStakeNumber = numericStake(totalStake);

  const stats = useMemo(() => {
    const sortedByStake = [...validators].sort(
      (a, b) =>
        numericStake(b.stakingPoolIotaBalance) -
        numericStake(a.stakingPoolIotaBalance)
    );
    const totalVotingPower = validators.reduce(
      (sum, validator) => sum + validator.votingPower,
      0
    );
    const topFiveStake = sortedByStake
      .slice(0, 5)
      .reduce(
        (sum, validator) => sum + numericStake(validator.stakingPoolIotaBalance),
        0
      );

    return {
      sortedByStake,
      totalVotingPower,
      avgApy: getAverageApy(validators),
      medianApy: getMedianApy(validators),
      avgCommission: getAverageCommission(validators),
      topFiveShare:
        totalStakeNumber > 0 ? (topFiveStake / totalStakeNumber) * 100 : null,
      activeValidators: validators.length,
    };
  }, [validators, totalStakeNumber]);

  const bestApyValidators = useMemo(
    () =>
      [...validators]
        .filter((validator) => validator.apy != null)
        .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
        .slice(0, TOP_VALIDATORS_COUNT),
    [validators]
  );

  const amount = Number(delegationAmount);
  const calculatorApy = stats.medianApy ?? stats.avgApy ?? 0;
  const yearlyReward =
    Number.isFinite(amount) && amount > 0 ? amount * calculatorApy : 0;
  const monthlyReward = yearlyReward / 12;
  const dailyReward = yearlyReward / 365;

  const openValidator = (address: string) => {
    if (!address) return;
    router.push(
      withNetworkParam(
        `/validators/${encodeURIComponent(address)}`,
        selectedNetwork
      )
    );
  };

  if (isLoading) {
    return <StakingSkeleton />;
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit capitalize">
              {network}
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Staking
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Compare validator pools, staking yield, commission, and stake
                concentration before choosing where to delegate.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit font-mono">
            Epoch #{epoch}
          </Badge>
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-2 text-sm text-destructive">
              Validator refresh failed. Showing cached staking data when
              available.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Coins}
            label="Total staked"
            value={`${formatIota(totalStake)} IOTA`}
            sub="Across active validator pools"
            variant="stat"
          />
          <MetricCard
            icon={TrendingUp}
            label="Median APY"
            value={formatApy(stats.medianApy)}
            sub={`Average ${formatApy(stats.avgApy)}`}
            variant="stat"
          />
          <MetricCard
            icon={Gauge}
            label="Average commission"
            value={
              stats.avgCommission == null
                ? '-'
                : formatCommission(stats.avgCommission)
            }
            sub="Validator fee before rewards"
            variant="stat"
          />
          <MetricCard
            icon={Users}
            label="Active validators"
            value={String(stats.activeValidators)}
            sub={`${formatPercent(stats.topFiveShare)} stake in top 5`}
            variant="stat"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Delegation calculator</CardTitle>
              <CardDescription>
                Estimate rewards with the current median APY. This is a simple
                projection, not a wallet quote.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Input
                    inputMode="decimal"
                    value={delegationAmount}
                    onChange={(event) => setDelegationAmount(event.target.value)}
                    className="h-10 pr-16 font-mono"
                    aria-label="Delegation amount"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    IOTA
                  </span>
                </div>
                <div className="flex gap-2">
                  {DELEGATION_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => setDelegationAmount(String(preset))}
                    >
                      {formatIotaAmount(preset)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                  <p className="font-mono text-2xl font-semibold">
                    {formatIotaAmount(dailyReward)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimated daily IOTA
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                  <p className="font-mono text-2xl font-semibold">
                    {formatIotaAmount(monthlyReward)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimated monthly IOTA
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                  <p className="font-mono text-2xl font-semibold">
                    {formatIotaAmount(yearlyReward)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimated yearly IOTA
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
                <Calculator className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  Rewards are estimated from median validator APY and do not
                  account for validator changes, compounding, network updates,
                  or future commission changes.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Stake distribution</CardTitle>
              <CardDescription>
                A quick decentralization check for the current validator set.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Top 5 share</span>
                  <span className="font-mono">
                    {formatPercent(stats.topFiveShare)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, stats.topFiveShare ?? 0)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                  <p className="font-mono text-xl font-semibold">
                    {formatApy(stats.medianApy)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Median APY
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                  <p className="font-mono text-xl font-semibold">
                    {formatApy(stats.avgApy)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Average APY
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/25 p-3 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  Lower concentration generally means voting power is spread
                  across more pools.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="largest" className="gap-4">
          <TabsList className="bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="largest">
              <Landmark className="size-4" />
              Largest pools
            </TabsTrigger>
            <TabsTrigger value="apy">
              <TrendingUp className="size-4" />
              Highest APY
            </TabsTrigger>
          </TabsList>

          <TabsContent value="largest">
            <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Largest staking pools</CardTitle>
                <CardDescription>
                  Validators ranked by current staking pool balance.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>Validator</TableHead>
                      <TableHead className="text-right">Stake</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">
                        APY
                      </TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Commission
                      </TableHead>
                      <TableHead className="hidden text-right lg:table-cell">
                        Voting power
                      </TableHead>
                      <TableHead className="hidden text-right lg:table-cell">
                        Pool share
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.sortedByStake
                      .slice(0, TOP_VALIDATORS_COUNT)
                      .map((validator, index) => (
                        <ValidatorRow
                          key={validator.iotaAddress || validator.name}
                          validator={validator}
                          totalVotingPower={stats.totalVotingPower}
                          totalStake={totalStakeNumber}
                          rank={index + 1}
                          onOpen={openValidator}
                        />
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apy">
            <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="gap-3 sm:grid sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <CardTitle>Highest APY validators</CardTitle>
                  <CardDescription>
                    APY is useful, but compare it with commission and pool size
                    before delegating.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => router.push(withNetworkParam('/validators', selectedNetwork))}
                >
                  All validators
                  <ArrowUpRight className="size-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>Validator</TableHead>
                      <TableHead className="text-right">Stake</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">
                        APY
                      </TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Commission
                      </TableHead>
                      <TableHead className="hidden text-right lg:table-cell">
                        Voting power
                      </TableHead>
                      <TableHead className="hidden text-right lg:table-cell">
                        Pool share
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bestApyValidators.map((validator, index) => (
                      <ValidatorRow
                        key={validator.iotaAddress || validator.name}
                        validator={validator}
                        totalVotingPower={stats.totalVotingPower}
                        totalStake={totalStakeNumber}
                        rank={index + 1}
                        onOpen={openValidator}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Yield',
              body: 'APY estimates rewards from recent validator performance. It can change by epoch.',
            },
            {
              title: 'Commission',
              body: 'Commission is the validator fee taken before rewards reach delegators.',
            },
            {
              title: 'Concentration',
              body: 'Large pools can be stable, but spreading stake improves validator-set diversity.',
            },
          ].map((item) => (
            <Card key={item.title} className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                {item.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
