'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Pause, Play } from 'lucide-react';

import type {
  AddressMetrics,
  AddressMetricsPoint,
  EpochSummary,
  IotaNetwork,
  NetworkMetrics,
  TransactionSummary,
} from '@/lib/iota/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { CopyAddressButton } from '@/components/validators/copy-address-button';
import { jsonFetcher } from '@/lib/client-fetcher';
import { useNetworkStore, withNetworkParam } from '@/lib/network-store';
import { formatAddress } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const TransactionBlocksChart = dynamic(
  () =>
    import('@/components/home/home-charts').then(
      (mod) => mod.TransactionBlocksChart
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton className="h-[260px]" />,
  }
);

const AddressesChart = dynamic(
  () =>
    import('@/components/home/home-charts').then((mod) => mod.AddressesChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton className="h-[180px]" />,
  }
);

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
  addressMetrics: AddressMetrics | null;
  addressSeries: AddressMetricsPoint[];
  epochStartTimestampMs: string | null;
  epochDurationMs: string | null;
};

type EpochsApiResponse = {
  network: IotaNetwork;
  epochs: EpochSummary[];
};

type TransactionsApiResponse = {
  network: IotaNetwork;
  transactions: TransactionSummary[];
};

const IOTA_DECIMALS = 9;
const NETWORK_REFRESH_MS = 30_000;
const EPOCHS_REFRESH_MS = 300_000;
const TRANSACTIONS_REFRESH_MS = 6_000;

function formatIotaCompact(raw: string | null): string {
  if (raw == null) return '—';
  const n = Number(raw) / 10 ** IOTA_DECIMALS;
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} K`;
  return n.toFixed(2);
}

function formatIotaSigned(raw: string | null): string {
  if (raw == null) return '—';
  let n: number;
  try {
    const big = BigInt(raw);
    n = Number(big) / 10 ** IOTA_DECIMALS;
  } catch {
    n = Number(raw) / 10 ** IOTA_DECIMALS;
  }
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000)
    return `${sign}${(abs / 1_000_000_000).toFixed(2)} B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)} M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2)} K`;
  return `${sign}${abs.toFixed(2)}`;
}

function bigSubtract(a: string | null, b: string | null): string | null {
  if (a == null || b == null) return null;
  try {
    return (BigInt(a) - BigInt(b)).toString();
  } catch {
    return null;
  }
}

function formatBigCompact(raw: string | number | null): string {
  if (raw == null) return '—';
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} K`;
  return new Intl.NumberFormat('en').format(n);
}

function formatTps(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} K`;
  return value.toFixed(value < 10 ? 2 : 0);
}

function formatExactNumber(raw: string | number | null): string {
  if (raw == null) return '—';
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n)) return String(raw);
  return new Intl.NumberFormat('en').format(n);
}

function formatDigestPreview(digest: string): string {
  return digest.length > 10 ? `${digest.slice(0, 10)}...` : digest;
}

function formatSenderPreview(sender: string): string {
  if (sender.length <= 14) return sender;
  return `${sender.slice(0, 7)}...${sender.slice(-4)}`;
}

function formatTimeAgo(timestampMs: string | null, now: number): string {
  if (!timestampMs) return '—';
  const ts = Number(timestampMs);
  if (!Number.isFinite(ts)) return '—';
  const seconds = Math.max(0, Math.floor((now - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatAbsoluteTime(timestampMs: string | null): string {
  if (!timestampMs) return '—';
  const n = Number(timestampMs);
  if (!Number.isFinite(n)) return '—';
  const d = new Date(n);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDurationCompact(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatStartTime(timestampMs: string | null): string {
  if (!timestampMs) return '—';
  const n = Number(timestampMs);
  if (!Number.isFinite(n)) return '—';
  const d = new Date(n);
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay
    ? `${time}, Today`
    : `${time}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function MetricBlock({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono sm:text-2xl text-xl font-semibold leading-none">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ChartSkeleton({ className }: { className: string }) {
  return <Skeleton className={cn('w-full rounded-lg', className)} />;
}

function useSectionVisibility<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      {
        root: null,
        rootMargin: '240px 0px',
        threshold: 0.05,
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const sync = () => setIsVisible(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return isVisible;
}

export function HomeInsights({ className }: { className?: string }) {
  const router = useRouter();
  const network = useNetworkStore((state) => state.network);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { ref: sectionRef, isVisible: sectionVisible } =
    useSectionVisibility<HTMLElement>();
  const { ref: transactionsRef, isVisible: transactionsVisible } =
    useSectionVisibility<HTMLDivElement>();
  const pageVisible = usePageVisibility();
  const sectionPolling = sectionVisible && pageVisible;
  const livePolling = !paused && transactionsVisible && pageVisible;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: networkData } = useSWR<NetworkApiResponse, Error>(
    withNetworkParam('/api/network', network),
    jsonFetcher,
    {
      refreshInterval: sectionPolling ? NETWORK_REFRESH_MS : 0,
      keepPreviousData: true,
      revalidateOnFocus: sectionPolling,
      isPaused: () => !sectionPolling,
      shouldRetryOnError: false,
    }
  );

  const { data: epochsData } = useSWR<EpochsApiResponse, Error>(
    withNetworkParam('/api/epochs', network),
    jsonFetcher,
    {
      refreshInterval: sectionPolling ? EPOCHS_REFRESH_MS : 0,
      keepPreviousData: true,
      revalidateOnFocus: sectionPolling,
      isPaused: () => !sectionPolling,
      shouldRetryOnError: false,
    }
  );

  const { data: txData } = useSWR<TransactionsApiResponse, Error>(
    withNetworkParam('/api/transactions', network),
    jsonFetcher,
    {
      refreshInterval: livePolling ? TRANSACTIONS_REFRESH_MS : 0,
      keepPreviousData: true,
      revalidateOnFocus: livePolling,
      isPaused: () => !livePolling,
      shouldRetryOnError: false,
    }
  );

  const metrics = networkData?.metrics;
  const totalTransactions =
    networkData?.recentCheckpoints?.[0]?.networkTotalTransactions ?? null;
  const lastEpochTransactions = useMemo(() => {
    const list = epochsData?.epochs ?? [];
    const finished = list.find((e) => e.epochEndTimestampMs != null);
    return finished?.epochTotalTransactions ?? null;
  }, [epochsData]);

  const transactionSeries = useMemo(() => {
    const list = [...(epochsData?.epochs ?? [])]
      .filter((e) => e.epochTotalTransactions != null)
      .sort((a, b) => Number(a.epoch) - Number(b.epoch));
    return list.map((e) => ({
      epoch: Number(e.epoch),
      epochLabel: e.epoch,
      transactions: Number(e.epochTotalTransactions) || 0,
    }));
  }, [epochsData]);

  const addressSeries = useMemo(() => {
    return (networkData?.addressSeries ?? []).map((p) => ({
      epoch: p.epoch,
      epochLabel: String(p.epoch),
      cumulativeAddresses: p.cumulativeAddresses,
      dailyActiveAddresses: p.dailyActiveAddresses,
    }));
  }, [networkData]);

  const epochStart = networkData?.epochStartTimestampMs ?? null;
  const epochDuration = networkData?.epochDurationMs ?? null;

  const epochProgress = useMemo(() => {
    if (!epochStart || !epochDuration) return 0;
    const start = Number(epochStart);
    const duration = Number(epochDuration);
    if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0)
      return 0;
    return Math.max(0, Math.min(100, ((now - start) / duration) * 100));
  }, [epochStart, epochDuration, now]);

  const epochCountdown = useMemo(() => {
    if (!epochStart || !epochDuration) return '—';
    const end = Number(epochStart) + Number(epochDuration);
    return formatDurationCompact(end - now);
  }, [epochStart, epochDuration, now]);

  const epochStartLabel = formatStartTime(epochStart);

  const txRows = txData?.transactions ?? [];
  const epochRows = epochsData?.epochs ?? [];
  const checkpointRows = networkData?.recentCheckpoints ?? [];

  const skeletonRows = (cols: number, count = 6) =>
    Array.from({ length: count }).map((_, i) => (
      <TableRow key={`s-${i}`} className="hover:bg-transparent">
        <TableCell colSpan={cols}>
          <Skeleton className="h-6 w-full" />
        </TableCell>
      </TableRow>
    ));

  return (
    <section
      ref={sectionRef}
      className={cn('relative mx-auto w-full max-w-7xl px-4 pb-8', className)}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Card 1: Network Activity ── */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle>Network Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <MetricBlock
                label="TPS Now"
                value={formatTps(metrics?.currentTps ?? null)}
              />
              <MetricBlock
                label="Peak 30d TPS"
                value={formatTps(metrics?.tps30Days ?? null)}
              />
              <MetricBlock
                label="Total Packages"
                value={formatExactNumber(metrics?.totalPackages ?? null)}
              />
              <MetricBlock
                label="Objects"
                value={formatBigCompact(metrics?.totalObjects ?? null)}
              />
              <MetricBlock
                label="Total Supply"
                value={formatIotaCompact(networkData?.totalSupply ?? null)}
                unit="IOTA"
              />
              <MetricBlock
                label="Circulating Supply"
                value={formatIotaCompact(
                  networkData?.circulatingSupply ?? null
                )}
                unit="IOTA"
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-semibold">
                  Epoch {metrics?.currentEpoch ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Started {epochStartLabel}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <MetricBlock label="Time Left" value={epochCountdown} />
                <MetricBlock
                  label="Checkpoint"
                  value={formatExactNumber(
                    networkData?.latestCheckpoint ??
                      metrics?.currentCheckpoint ??
                      null
                  )}
                />
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${epochProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Card 2: Transaction Blocks ── */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle>Transaction Blocks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <MetricBlock
                label="Total"
                value={formatBigCompact(totalTransactions)}
              />
              <MetricBlock
                label="Last epoch"
                value={formatBigCompact(lastEpochTransactions)}
              />
            </div>
            <TransactionBlocksChart data={transactionSeries} />
          </CardContent>
        </Card>

        {/* ── Card 3: Addresses ── */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <MetricBlock
                label="Total"
                value={formatBigCompact(metrics?.totalAddresses ?? null)}
              />
              <MetricBlock
                label="Total Active"
                value={formatBigCompact(
                  networkData?.addressMetrics?.cumulativeActiveAddresses ?? null
                )}
              />
              <MetricBlock
                label="Daily Active"
                value={formatBigCompact(
                  networkData?.addressMetrics?.dailyActiveAddresses ?? null
                )}
              />
            </div>
            <AddressesChart data={addressSeries} />
          </CardContent>
        </Card>
      </div>

      {/* ── Activity tabs ── */}
      <Tabs defaultValue="transactions" className="mt-6">
        <TabsList className="mb-4 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="epochs">Epochs</TabsTrigger>
          <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
        </TabsList>

        {/* ── Transactions ── */}
        <TabsContent value="transactions">
          <Card
            ref={transactionsRef}
            className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden"
          >
            <CardHeader className="pb-3">
              <div className="flex flex-row items-center w-full justify-between">
                <CardTitle className="text-base font-semibold">
                  Latest transactions
                  <Badge variant="secondary" className="ml-2 font-mono text-xs">
                    {txRows.length}
                  </Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={
                    paused ? 'Resume live updates' : 'Pause live updates'
                  }
                  className="gap-2"
                >
                  {paused ? (
                    <>
                      <Play className="size-4" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause className="size-4" /> Live · 6s
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Digest</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead className="text-right">Txns</TableHead>
                    <TableHead className="text-right">Gas</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!txData ? (
                    skeletonRows(6)
                  ) : txRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-20 text-center text-muted-foreground"
                      >
                        No transactions yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    txRows.map((tx, i) => (
                      <TableRow
                        key={tx.digest}
                        className="group cursor-pointer hover:bg-muted/40"
                        onClick={() =>
                          router.push(
                            withNetworkParam(
                              `/transactions/${encodeURIComponent(tx.digest)}`,
                              network
                            )
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            router.push(
                              withNetworkParam(
                                `/transactions/${encodeURIComponent(tx.digest)}`,
                                network
                              )
                            );
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open transaction ${tx.digest}`}
                      >
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-mono text-xs">
                              {formatDigestPreview(tx.digest)}
                            </span>
                            <CopyAddressButton
                              address={tx.digest}
                              showLabel={false}
                            />
                            {tx.status && tx.status !== 'success' && (
                              <Badge
                                variant="destructive"
                                className="font-mono text-[10px]"
                              >
                                {tx.status}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                            {tx.sender &&
                            tx.sender !=
                              '0x0000000000000000000000000000000000000000000000000000000000000000' ? (
                              <span className="truncate font-mono">
                                {formatSenderPreview(tx.sender)}
                              </span>
                            ) : (
                              <>
                                <span className="truncate">
                                  IOTA System Account
                                </span>
                                <span className="font-mono">0x0</span>
                              </>
                            )}
                            <CopyAddressButton
                              address={tx.sender ?? '0x0'}
                              showLabel={false}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {tx.txCount != null ? tx.txCount : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {tx.gasUsed != null
                            ? `${formatIotaCompact(tx.gasUsed)} IOTA`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatTimeAgo(tx.timestampMs, now)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Epochs ── */}
        <TabsContent value="epochs">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Recent epochs
                <Badge variant="secondary" className="ml-2 font-mono text-xs">
                  {epochRows.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Epoch</TableHead>
                    <TableHead className="text-right">
                      Transaction Blocks
                    </TableHead>
                    <TableHead className="text-right">Stake Rewards</TableHead>
                    <TableHead className="hidden md:table-cell text-right">
                      Checkpoint Set
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-right">
                      Storage Net Inflow
                    </TableHead>
                    <TableHead className="text-right">Epoch End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!epochsData
                    ? skeletonRows(7)
                    : epochRows.map((e, i) => {
                        const storageNet = bigSubtract(
                          e.storageCharge,
                          e.storageRebate
                        );
                        return (
                          <TableRow key={e.epoch} className="hover:bg-muted/40">
                            <TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {i + 1}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {e.epoch}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatBigCompact(e.epochTotalTransactions)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  e.totalStakeRewardsDistributed
                                    ? 'default'
                                    : 'secondary'
                                }
                                className="font-mono text-xs"
                              >
                                {e.totalStakeRewardsDistributed
                                  ? `${formatIotaCompact(
                                      e.totalStakeRewardsDistributed
                                    )} IOTA`
                                  : '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-right font-mono text-xs text-muted-foreground">
                              {formatExactNumber(e.firstCheckpointId)}
                              {' – '}
                              {e.lastCheckpointId
                                ? formatExactNumber(e.lastCheckpointId)
                                : '…'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-right font-mono text-sm">
                              {storageNet != null
                                ? `${formatIotaSigned(storageNet)} IOTA`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              {e.epochEndTimestampMs
                                ? formatAbsoluteTime(e.epochEndTimestampMs)
                                : 'In progress'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Checkpoints ── */}
        <TabsContent value="checkpoints">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Recent checkpoints
                <Badge variant="secondary" className="ml-2 font-mono text-xs">
                  {checkpointRows.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Digest</TableHead>
                    <TableHead className="text-right">
                      Sequence Number
                    </TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!networkData
                    ? skeletonRows(5)
                    : checkpointRows.map((cp, i) => (
                        <TableRow
                          key={cp.sequenceNumber}
                          className="hover:bg-muted/40"
                        >
                          <TableCell className="text-center text-xs text-muted-foreground font-mono">
                            {i + 1}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {cp.digest ? formatAddress(cp.digest, 8) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatExactNumber(cp.sequenceNumber)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatExactNumber(cp.transactionCount)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {formatTimeAgo(cp.timestampMs, now)}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
