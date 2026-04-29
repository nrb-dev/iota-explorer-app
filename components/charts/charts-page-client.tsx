'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  Database,
  Gauge,
  RadioTower,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  AddressMetricsPoint,
  EpochSummary,
  IotaNetwork,
  NetworkMetrics,
} from '@/lib/iota/types';
import { jsonFetcher } from '@/lib/client-fetcher';
import { useNetworkStore, withNetworkParam } from '@/lib/network-store';
import { cn } from '@/lib/utils';
import { formatCompactNumber } from '@/lib/formatters';
import { MetricCard } from '@/components/metric-card';
import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
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

type NetworkApiResponse = {
  network: IotaNetwork;
  metrics: NetworkMetrics;
  circulatingSupply: string | null;
  totalSupply: string | null;
  referenceGasPrice: string;
  latestCheckpoint: string | null;
  recentCheckpoints: Array<{
    sequenceNumber: string;
    digest: string | null;
    timestampMs: string;
    networkTotalTransactions: string;
    transactionCount: number;
  }>;
  addressSeries: AddressMetricsPoint[];
};

type EpochsApiResponse = {
  network: IotaNetwork;
  epochs: EpochSummary[];
};

type RangeKey = '7' | '14' | '30';
type MetricKey = 'transactions' | 'gasFees' | 'stakeRewards';
type EconomicsMetricKey = 'gasFees' | 'stakeRewards';
type AddressMetricKey = 'cumulativeAddresses' | 'dailyActiveAddresses';

type EpochChartPoint = {
  epoch: number;
  epochLabel: string;
  isComplete: boolean;
  transactions: number;
  gasFees: number;
  stakeRewards: number;
};

type AddressChartPoint = {
  epoch: number;
  epochLabel: string;
  cumulativeAddresses: number;
  dailyActiveAddresses: number;
};

const IOTA_DECIMALS = 9;
const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '7', label: '7E' },
  { value: '14', label: '14E' },
  { value: '30', label: '30E' },
];

const metricLabels: Record<MetricKey, string> = {
  transactions: 'Transaction blocks',
  gasFees: 'Gas fees',
  stakeRewards: 'Rewards distributed',
};

const epochChartConfig = {
  transactions: { label: 'Transaction blocks', color: 'var(--chart-2)' },
  gasFees: { label: 'Gas fees', color: 'var(--chart-3)' },
  stakeRewards: { label: 'Stake rewards', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const addressChartConfig = {
  cumulativeAddresses: { label: 'Total addresses', color: 'var(--chart-4)' },
  dailyActiveAddresses: { label: 'Daily active', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function formatIota(raw: string | number | null): string {
  if (raw == null) return '-';
  const n = (typeof raw === 'string' ? Number(raw) : raw) / 10 ** IOTA_DECIMALS;
  if (!Number.isFinite(n)) return '-';
  return formatCompactNumber(n);
}

function formatIotaValue(raw: string | number | null): number {
  if (raw == null) return 0;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return Number.isFinite(n) ? n / 10 ** IOTA_DECIMALS : 0;
}

function formatNumber(raw: string | number | null): string {
  if (raw == null) return '-';
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n)) return '-';
  return formatCompactNumber(n);
}

function formatGasPrice(raw: string | null): string {
  if (!raw) return '-';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '-';
  return `${formatCompactNumber(n)} NANO`;
}

function formatDate(timestampMs: string | null): string {
  if (!timestampMs) return '-';
  const n = Number(timestampMs);
  if (!Number.isFinite(n)) return '-';
  return new Date(n).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function isLoading(
  networkData: NetworkApiResponse | undefined,
  epochsData: EpochsApiResponse | undefined
) {
  return !networkData || !epochsData;
}

function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-[320px] w-full rounded-lg', className)} />;
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-border/70 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function ValueChange({
  current,
  previous,
  suffix,
}: {
  current: number;
  previous: number | null;
  suffix?: string;
}) {
  if (previous == null || previous === 0) {
    return <span>No previous epoch</span>;
  }

  const change = ((current - previous) / previous) * 100;
  const positive = change >= 0;

  return (
    <span className={positive ? 'text-emerald-600' : 'text-destructive'}>
      {positive ? '+' : ''}
      {change.toFixed(1)}%{suffix ? ` ${suffix}` : ''}
    </span>
  );
}

function EpochMetricChart({
  data,
  metric,
}: {
  data: EpochChartPoint[];
  metric: MetricKey;
}) {
  if (data.length === 0) {
    return <EmptyChart label="No epoch data available." />;
  }

  const isIotaMetric = metric !== 'transactions';

  return (
    <ChartContainer config={epochChartConfig} className="h-[320px] w-full">
      <AreaChart data={data} margin={{ left: 8, right: 12, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="epoch"
          tickLine={false}
          axisLine={false}
          minTickGap={20}
          type="number"
          domain={['dataMin', 'dataMax']}
        />
        <YAxis hide />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
          labelFormatter={(_, payload) =>
            payload?.[0]?.payload?.epochLabel
              ? `Epoch ${payload[0].payload.epochLabel}`
              : 'Epoch'
          }
          formatter={(value) =>
            isIotaMetric
              ? `${formatNumber(Number(value))} IOTA`
              : formatNumber(Number(value))
          }
        />
        <Area
          dataKey={metric}
          name={metric}
          type="monotone"
          stroke={`var(--color-${metric})`}
          fill={`var(--color-${metric})`}
          fillOpacity={0.18}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function CompactAreaChart({
  data,
  metric,
}: {
  data: EpochChartPoint[];
  metric: MetricKey;
}) {
  return (
    <ChartContainer config={epochChartConfig} className="h-[150px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <XAxis dataKey="epoch" hide type="number" domain={['dataMin', 'dataMax']} />
        <YAxis hide />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
          formatter={(value) =>
            metric === 'transactions'
              ? formatNumber(Number(value))
              : `${formatNumber(Number(value))} IOTA`
          }
        />
        <Area
          dataKey={metric}
          type="monotone"
          stroke={`var(--color-${metric})`}
          fill={`var(--color-${metric})`}
          fillOpacity={0.16}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function GasBarChart({ data }: { data: EpochChartPoint[] }) {
  return (
    <ChartContainer config={epochChartConfig} className="h-[150px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <XAxis dataKey="epoch" hide type="number" domain={['dataMin', 'dataMax']} />
        <YAxis hide />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
          formatter={(value) => `${formatNumber(Number(value))} IOTA`}
        />
        <Bar
          dataKey="gasFees"
          fill="var(--color-gasFees)"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}

function AddressChart({
  data,
  metric,
}: {
  data: AddressChartPoint[];
  metric: AddressMetricKey;
}) {
  if (data.length === 0) {
    return <EmptyChart label="No address series available." />;
  }

  return (
    <ChartContainer config={addressChartConfig} className="h-[320px] w-full">
      <LineChart data={data} margin={{ left: 8, right: 12, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="epoch"
          tickLine={false}
          axisLine={false}
          minTickGap={20}
          type="number"
          domain={['dataMin', 'dataMax']}
        />
        <YAxis hide />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
          labelFormatter={(_, payload) =>
            payload?.[0]?.payload?.epochLabel
              ? `Epoch ${payload[0].payload.epochLabel}`
              : 'Epoch'
          }
          formatter={(value) => formatNumber(Number(value))}
        />
        <Line
          dataKey={metric}
          name={metric}
          type="monotone"
          stroke={`var(--color-${metric})`}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function ChartsPageClient() {
  const network = useNetworkStore((state) => state.network);
  const [range, setRange] = useState<RangeKey>('30');
  const [economicsMetric, setEconomicsMetric] =
    useState<EconomicsMetricKey>('gasFees');
  const [addressMetric, setAddressMetric] =
    useState<AddressMetricKey>('cumulativeAddresses');

  const { data: networkData, error: networkError } = useSWR<
    NetworkApiResponse,
    Error
  >(withNetworkParam('/api/network', network), jsonFetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
    shouldRetryOnError: false,
  });

  const { data: epochsData, error: epochsError } = useSWR<
    EpochsApiResponse,
    Error
  >(withNetworkParam('/api/epochs', network), jsonFetcher, {
    refreshInterval: 300_000,
    keepPreviousData: true,
    shouldRetryOnError: false,
  });

  const epochSeries = useMemo(() => {
    return [...(epochsData?.epochs ?? [])]
      .sort((a, b) => Number(a.epoch) - Number(b.epoch))
      .map((epoch) => ({
        epoch: Number(epoch.epoch),
        epochLabel: epoch.epoch,
        isComplete: epoch.epochEndTimestampMs != null,
        transactions: Number(epoch.epochTotalTransactions) || 0,
        gasFees: formatIotaValue(epoch.totalGasFees),
        stakeRewards: formatIotaValue(epoch.totalStakeRewardsDistributed),
      }))
      .filter((point) => Number.isFinite(point.epoch));
  }, [epochsData]);

  const addressSeries = useMemo(() => {
    return (networkData?.addressSeries ?? []).map((point) => ({
      epoch: point.epoch,
      epochLabel: String(point.epoch),
      cumulativeAddresses: point.cumulativeAddresses,
      dailyActiveAddresses: point.dailyActiveAddresses,
    }));
  }, [networkData]);

  const visibleEpochSeries = useMemo(
    () => epochSeries.slice(-Number(range)),
    [epochSeries, range]
  );

  const visibleAddressSeries = useMemo(
    () => addressSeries.slice(-Number(range)),
    [addressSeries, range]
  );

  const completedEpochSeries = useMemo(
    () => epochSeries.filter((point) => point.isComplete),
    [epochSeries]
  );

  const latestEpoch = completedEpochSeries.at(-1) ?? epochSeries.at(-1) ?? null;
  const previousEpoch =
    completedEpochSeries.at(-2) ??
    (latestEpoch ? epochSeries[epochSeries.indexOf(latestEpoch) - 1] : null) ??
    null;
  const latestCheckpoint = networkData?.recentCheckpoints?.[0] ?? null;
  const metrics = networkData?.metrics;
  const hasError = Boolean(networkError || epochsError);

  const transactionCurrent = latestEpoch?.transactions ?? 0;
  const transactionPrevious = previousEpoch?.transactions ?? null;
  const economicsCurrent = latestEpoch?.[economicsMetric] ?? 0;
  const economicsPrevious = previousEpoch?.[economicsMetric] ?? null;

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
                Network Charts
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Activity, usage, and economics signals for recent IOTA epochs.
                These charts focus on network health rather than token price.
              </p>
            </div>
          </div>
          <div className="flex w-fit rounded-lg bg-muted p-[3px]">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={range === option.value ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setRange(option.value)}
                className="min-w-12"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {hasError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-2 text-sm text-destructive">
              Unable to load fresh chart data right now.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={RadioTower}
            label="Current TPS"
            value={formatNumber(metrics?.currentTps ?? null)}
            sub="Live network throughput"
            variant="stat"
          />
          <MetricCard
            icon={Database}
            label="Total transactions"
            value={formatNumber(
              latestCheckpoint?.networkTotalTransactions ?? null
            )}
            sub={`Checkpoint ${formatNumber(latestCheckpoint?.sequenceNumber ?? null)}`}
            variant="stat"
          />
          <MetricCard
            icon={Users}
            label="Total addresses"
            value={formatNumber(metrics?.totalAddresses ?? null)}
            sub={`${formatNumber(addressSeries.at(-1)?.dailyActiveAddresses ?? null)} daily active`}
            variant="stat"
          />
          <MetricCard
            icon={Gauge}
            label="Reference gas"
            value={formatGasPrice(networkData?.referenceGasPrice ?? null)}
            sub={`Epoch ${metrics?.currentEpoch ?? '-'}`}
            variant="stat"
          />
        </div>

        <Tabs defaultValue="activity" className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="bg-muted/50 backdrop-blur-sm">
              <TabsTrigger value="activity">
                <Activity className="size-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="usage">
                <Users className="size-4" />
                Usage
              </TabsTrigger>
              <TabsTrigger value="economics">
                <BarChart3 className="size-4" />
                Economics
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="activity" className="space-y-4">
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardHeader>
                <div>
                  <CardTitle>Network activity</CardTitle>
                  <CardDescription>
                    Transaction blocks show how much work the network processed
                    in each completed epoch.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {formatNumber(transactionCurrent)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Transaction blocks, latest completed epoch
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      <ValueChange
                        current={transactionCurrent}
                        previous={transactionPrevious}
                        suffix="vs previous"
                      />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Momentum
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {latestEpoch?.epochLabel ?? '-'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Latest epoch in series
                    </p>
                  </div>
                </div>
                {isLoading(networkData, epochsData) ? (
                  <ChartSkeleton />
                ) : (
                  <EpochMetricChart
                    data={visibleEpochSeries}
                    metric="transactions"
                  />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/50 bg-card/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="size-4 text-primary" />
                    Transaction trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {epochsData ? (
                    <CompactAreaChart
                      data={visibleEpochSeries}
                      metric="transactions"
                    />
                  ) : (
                    <ChartSkeleton className="h-[150px]" />
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RadioTower className="size-4 text-primary" />
                    Throughput snapshot
                  </CardTitle>
                  <CardDescription>
                    Current and 30 day peak TPS from the selected network.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {formatNumber(metrics?.currentTps ?? null)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current TPS
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {formatNumber(metrics?.tps30Days ?? null)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Peak 30d TPS
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardHeader className="gap-4 lg:grid lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <CardTitle>Network usage</CardTitle>
                  <CardDescription>
                    Address growth helps separate raw throughput from actual
                    user and account activity.
                  </CardDescription>
                </div>
                <div className="flex w-fit rounded-lg bg-muted p-[3px]">
                  <Button
                    variant={
                      addressMetric === 'cumulativeAddresses'
                        ? 'secondary'
                        : 'ghost'
                    }
                    size="sm"
                    onClick={() => setAddressMetric('cumulativeAddresses')}
                  >
                    Total
                  </Button>
                  <Button
                    variant={
                      addressMetric === 'dailyActiveAddresses'
                        ? 'secondary'
                        : 'ghost'
                    }
                    size="sm"
                    onClick={() => setAddressMetric('dailyActiveAddresses')}
                  >
                    Daily active
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {formatNumber(metrics?.totalAddresses ?? null)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Total addresses
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {formatNumber(
                        addressSeries.at(-1)?.dailyActiveAddresses ?? null
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Daily active addresses
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {formatNumber(
                        addressSeries.at(-1)?.cumulativeAddresses ?? null
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Latest address series point
                    </p>
                  </div>
                </div>
                {networkData ? (
                  <AddressChart
                    data={visibleAddressSeries}
                    metric={addressMetric}
                  />
                ) : (
                  <ChartSkeleton />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="economics" className="space-y-4">
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardHeader className="gap-4 lg:grid lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <CardTitle>Network economics</CardTitle>
                  <CardDescription>
                    Gas fees and distributed rewards show the economic activity
                    recorded by each completed epoch.
                  </CardDescription>
                </div>
                <div className="flex w-fit rounded-lg bg-muted p-[3px]">
                  {(['gasFees', 'stakeRewards'] as EconomicsMetricKey[]).map(
                    (value) => (
                      <Button
                        key={value}
                        variant={
                          economicsMetric === value ? 'secondary' : 'ghost'
                        }
                        size="sm"
                        onClick={() => setEconomicsMetric(value)}
                      >
                        {metricLabels[value]}
                      </Button>
                    )
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {formatNumber(economicsCurrent)} IOTA
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {metricLabels[economicsMetric]}, latest completed epoch
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      <ValueChange
                        current={economicsCurrent}
                        previous={economicsPrevious}
                        suffix="vs previous"
                      />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Momentum
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {formatGasPrice(networkData?.referenceGasPrice ?? null)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reference gas price
                    </p>
                  </div>
                </div>
                {isLoading(networkData, epochsData) ? (
                  <ChartSkeleton />
                ) : (
                  <EpochMetricChart
                    data={visibleEpochSeries}
                    metric={economicsMetric}
                  />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/50 bg-card/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CircleDollarSign className="size-4 text-primary" />
                    Gas fees
                  </CardTitle>
                  <CardDescription>
                    Total gas fees paid per epoch, converted to IOTA.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {epochsData ? (
                    <GasBarChart data={visibleEpochSeries} />
                  ) : (
                    <ChartSkeleton className="h-[150px]" />
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="size-4 text-primary" />
                    Rewards distributed
                  </CardTitle>
                  <CardDescription>
                    Validator and delegator rewards distributed by epoch.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {epochsData ? (
                    <CompactAreaChart
                      data={visibleEpochSeries}
                      metric="stakeRewards"
                    />
                  ) : (
                    <ChartSkeleton className="h-[150px]" />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Recent epochs</CardTitle>
            <CardDescription>
              Raw values behind the charts for the latest epoch window.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Epoch</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Gas fees</TableHead>
                  <TableHead className="text-right">Rewards</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!epochsData ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index} className="hover:bg-transparent">
                      <TableCell colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : visibleEpochSeries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No epochs available.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...(epochsData.epochs ?? [])]
                    .sort((a, b) => Number(b.epoch) - Number(a.epoch))
                    .slice(0, Number(range))
                    .map((epoch) => (
                      <TableRow key={epoch.epoch}>
                        <TableCell className="font-mono">
                          {epoch.epoch}
                        </TableCell>
                        <TableCell>{formatDate(epoch.epochStartTimestampMs)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(epoch.epochTotalTransactions)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatIota(epoch.totalGasFees)} IOTA
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatIota(epoch.totalStakeRewardsDistributed)} IOTA
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
