import type { Metadata } from 'next';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { notFound } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Coins,
  Database,
  ExternalLink,
  Gauge,
  Percent,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { CopyAddressButton } from '@/components/validators/copy-address-button';
import { ValidatorAvatar } from '@/components/validators/validator-avatar';
import { ValidatorDetailMap } from '@/components/validators/validator-detail-map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getValidatorsData, parseIotaNetwork } from '@/lib/iota';
import {
  formatAddress,
  formatApy,
  formatCommission,
  formatCompactNumber,
  formatIota,
  formatVotingPower,
} from '@/lib/formatters';

export const revalidate = 60;

type Props = {
  params: Promise<{ address: string }>;
  searchParams?: Promise<{ network?: string | string[] }>;
};

async function getPageData(address: string, networkParam?: string | string[]) {
  const network = parseIotaNetwork(
    Array.isArray(networkParam) ? networkParam[0] : networkParam
  );
  const data = await getValidatorsData(network);
  const target = decodeURIComponent(address).toLowerCase();
  const validator =
    data.validators.find((v) => v.iotaAddress.toLowerCase() === target) ?? null;
  return { data, validator };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const { validator } = await getPageData(address);

  if (!validator) {
    return {
      title: 'Validator not found',
    };
  }

  return {
    title: `${validator.name} | IOTA Validator`,
    description:
      validator.description ||
      `IOTA validator details for ${validator.name}: stake, APY, commission, voting power, and geography.`,
    openGraph: {
      title: `${validator.name} | IOTA Validator`,
      description:
        validator.description ||
        `Live IOTA validator details for ${validator.name}.`,
      images: validator.imageUrl ? [validator.imageUrl] : undefined,
    },
  };
}

function DetailStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/50 bg-card/70">
      <CardContent className="flex items-start gap-3 py-1">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 truncate font-mono text-lg font-semibold">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] truncate text-right font-mono">{value}</span>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 truncate font-mono text-base font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) {
    return (
      <Badge variant="secondary" className="font-mono">
        No change
      </Badge>
    );
  }

  return (
    <Badge variant={value > 0 ? 'default' : 'outline'} className="font-mono">
      {value > 0 ? '+' : ''}
      {formatIota(String(value))} IOTA
    </Badge>
  );
}

export default async function ValidatorDetail({ params, searchParams }: Props) {
  const { address } = await params;
  const resolvedSearchParams = await searchParams;
  const { data, validator } = await getPageData(
    address,
    resolvedSearchParams?.network
  );

  if (!validator) notFound();

  const totalVotingPower = data.validators.reduce(
    (sum, v) => sum + v.votingPower,
    0
  );
  const stakeShare =
    Number(data.totalStake) > 0
      ? (Number(validator.stakingPoolIotaBalance) / Number(data.totalStake)) *
        100
      : 0;
  const sortedByStake = [...data.validators].sort(
    (a, b) =>
      Number(b.stakingPoolIotaBalance) - Number(a.stakingPoolIotaBalance)
  );
  const sortedByVotingPower = [...data.validators].sort(
    (a, b) => b.votingPower - a.votingPower
  );
  const sortedByApy = data.validators
    .filter((v) => v.apy != null)
    .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0));
  const sortedByCommission = [...data.validators].sort(
    (a, b) => a.commissionRate - b.commissionRate
  );
  const stakeRank =
    sortedByStake.findIndex((v) => v.iotaAddress === validator.iotaAddress) + 1;
  const votingRank =
    sortedByVotingPower.findIndex(
      (v) => v.iotaAddress === validator.iotaAddress
    ) + 1;
  const apyRank =
    sortedByApy.findIndex((v) => v.iotaAddress === validator.iotaAddress) + 1;
  const commissionRank =
    sortedByCommission.findIndex(
      (v) => v.iotaAddress === validator.iotaAddress
    ) + 1;
  const nextEpochStakeDelta =
    Number(validator.nextEpochStake) - Number(validator.stakingPoolIotaBalance);
  const nextCommission =
    validator.nextEpochCommissionRate != null
      ? formatCommission(validator.nextEpochCommissionRate)
      : '—';
  const currentGas = validator.gasPrice || data.referenceGasPrice || '0';
  const nextGas = validator.nextEpochGasPrice || '0';
  const hasGeo = validator.lat != null && validator.lng != null;
  const operationalSignals = [
    Boolean(validator.netAddress),
    Boolean(validator.projectUrl),
    Boolean(validator.stakingPoolId),
    Boolean(validator.protocolPubkey),
    Boolean(validator.networkPubkey),
    hasGeo,
  ];
  const signalScore = operationalSignals.filter(Boolean).length;
  const signalTone =
    signalScore >= 5 ? 'Strong' : signalScore >= 3 ? 'Partial' : 'Limited';
  const location =
    validator.country === 'Unknown'
      ? 'Unknown location'
      : `${validator.city ? `${validator.city}, ` : ''}${validator.country}`;

  return (
    <main className="min-h-screen pt-28">
      <section className="mx-auto w-full max-w-7xl px-4 pb-20">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          nativeButton={false}
          render={<Link href={`/validators?network=${data.network}`} />}
        >
          <ArrowLeft className="size-4" />
          Validators
        </Button>

        <Card className="border-border/50 bg-card/70 backdrop-blur-sm">
          <CardContent className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <ValidatorAvatar
                name={validator.name}
                imageUrl={validator.imageUrl}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold tracking-normal">
                    {validator.name}
                  </h1>
                  <Badge variant="secondary">{location}</Badge>
                </div>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  {validator.description ||
                    'No validator description provided.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <CopyAddressButton address={validator.iotaAddress} />
              {validator.projectUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <a
                      href={validator.projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Visit project
                  <ExternalLink className="size-3.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <DetailStat
            icon={Wallet}
            label="Stake"
            value={`${formatIota(validator.stakingPoolIotaBalance)} IOTA`}
            sub={`${stakeShare.toFixed(2)}% of active stake`}
          />
          <DetailStat
            icon={ShieldCheck}
            label="Voting Power"
            value={formatVotingPower(validator.votingPower, totalVotingPower)}
            sub={formatCompactNumber(validator.votingPower)}
          />
          <DetailStat
            icon={TrendingUp}
            label="APY"
            value={formatApy(validator.apy)}
          />
          <DetailStat
            icon={Gauge}
            label="Commission"
            value={formatCommission(validator.commissionRate)}
          />
          <DetailStat
            icon={Activity}
            label="Operational signals"
            value={`${signalScore}/${operationalSignals.length}`}
            sub={`${signalTone} public metadata`}
          />
        </div>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="events">Stake events</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border/50 bg-card/70">
                <CardHeader>
                  <CardTitle>Validator profile</CardTitle>
                  <CardDescription>
                    Location, public presence, and current set ranking.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ValidatorDetailMap validator={validator} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoTile
                      icon={Wallet}
                      label="Stake rank"
                      value={stakeRank > 0 ? `#${stakeRank}` : '—'}
                      sub={`of ${data.validators.length} active validators`}
                    />
                    <InfoTile
                      icon={ShieldCheck}
                      label="Voting power rank"
                      value={votingRank > 0 ? `#${votingRank}` : '—'}
                      sub={formatVotingPower(
                        validator.votingPower,
                        totalVotingPower
                      )}
                    />
                    <InfoTile
                      icon={TrendingUp}
                      label="APY rank"
                      value={apyRank > 0 ? `#${apyRank}` : '—'}
                      sub={formatApy(validator.apy)}
                    />
                    <InfoTile
                      icon={Percent}
                      label="Commission rank"
                      value={commissionRank > 0 ? `#${commissionRank}` : '—'}
                      sub="Lower commission ranks first"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/70">
                <CardHeader>
                  <CardTitle>Current epoch</CardTitle>
                  <CardDescription>
                    Current values from the active IOTA validator set.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MetadataRow
                    label="Epoch"
                    value={`${data.network} #${data.epoch || '0'}`}
                  />
                  <Separator />
                  <MetadataRow
                    label="Address"
                    value={formatAddress(validator.iotaAddress, 10)}
                  />
                  <Separator />
                  <MetadataRow label="Region" value={validator.region} />
                  <Separator />
                  <MetadataRow label="Country" value={validator.country} />
                  <Separator />
                  <MetadataRow
                    label="Network"
                    value={validator.netAddress || '—'}
                  />
                  <Separator />
                  <MetadataRow
                    label="Next epoch stake"
                    value={`${formatIota(validator.nextEpochStake)} IOTA`}
                  />
                  <Separator />
                  <MetadataRow
                    label="Rewards pool"
                    value={`${formatIota(validator.rewardsPool)} IOTA`}
                  />
                  <Separator />
                  <MetadataRow
                    label="Reference gas"
                    value={data.referenceGasPrice || validator.gasPrice || '—'}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="border-border/50 bg-card/70">
                <CardHeader>
                  <CardTitle>Staking pool accounting</CardTitle>
                  <CardDescription>
                    Pool balances and queued stake movement exposed by the
                    validator set snapshot.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <InfoTile
                    icon={Coins}
                    label="Pool balance"
                    value={`${formatIota(
                      validator.stakingPoolIotaBalance
                    )} IOTA`}
                    sub={`${stakeShare.toFixed(2)}% of total active stake`}
                  />
                  <InfoTile
                    icon={Wallet}
                    label="Rewards pool"
                    value={`${formatIota(validator.rewardsPool)} IOTA`}
                  />
                  <InfoTile
                    icon={Database}
                    label="Pool token balance"
                    value={formatCompactNumber(validator.poolTokenBalance)}
                  />
                  <InfoTile
                    icon={TrendingUp}
                    label="Pending stake"
                    value={`${formatIota(validator.pendingStake)} IOTA`}
                  />
                  <InfoTile
                    icon={Wallet}
                    label="Pending IOTA withdraw"
                    value={`${formatIota(
                      validator.pendingTotalIotaWithdraw
                    )} IOTA`}
                  />
                  <InfoTile
                    icon={Database}
                    label="Pending pool token withdraw"
                    value={formatCompactNumber(
                      validator.pendingPoolTokenWithdraw
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/70">
                <CardHeader>
                  <CardTitle>Next epoch changes</CardTitle>
                  <CardDescription>
                    Changes already published for the next epoch, when
                    available.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoTile
                      icon={Wallet}
                      label="Next epoch stake"
                      value={`${formatIota(validator.nextEpochStake)} IOTA`}
                      sub="Published next-epoch pool stake"
                    />
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="size-3.5" />
                        <span>Stake delta</span>
                      </div>
                      <div className="mt-2">
                        <DeltaBadge value={nextEpochStakeDelta} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Compared with current pool balance
                      </p>
                    </div>
                    <InfoTile
                      icon={Gauge}
                      label="Next gas price"
                      value={nextGas !== '0' ? nextGas : '—'}
                      sub={`Current: ${currentGas || '—'}`}
                    />
                    <InfoTile
                      icon={Percent}
                      label="Next commission"
                      value={nextCommission}
                      sub={`Current: ${formatCommission(
                        validator.commissionRate
                      )}`}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
                    {signalScore >= 5 ? (
                      <BadgeCheck className="mt-0.5 size-4 text-primary" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {signalTone} operational metadata
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        This score checks presence of network address, project
                        URL, staking pool id, protocol key, network key, and geo
                        enrichment. It is not a liveness guarantee.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-border/50 bg-card/70">
                <CardHeader>
                  <CardTitle>Performance snapshot</CardTitle>
                  <CardDescription>
                    Current epoch baseline until the phase 4 snapshot indexer
                    starts persisting history.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <InfoTile
                    icon={TrendingUp}
                    label="Current APY"
                    value={formatApy(validator.apy)}
                    sub={apyRank > 0 ? `Rank #${apyRank}` : undefined}
                  />
                  <InfoTile
                    icon={Wallet}
                    label="Current stake"
                    value={`${formatIota(
                      validator.stakingPoolIotaBalance
                    )} IOTA`}
                    sub={stakeRank > 0 ? `Rank #${stakeRank}` : undefined}
                  />
                  <InfoTile
                    icon={ShieldCheck}
                    label="Voting share"
                    value={formatVotingPower(
                      validator.votingPower,
                      totalVotingPower
                    )}
                    sub={votingRank > 0 ? `Rank #${votingRank}` : undefined}
                  />
                  <InfoTile
                    icon={Percent}
                    label="Commission"
                    value={formatCommission(validator.commissionRate)}
                    sub={
                      commissionRank > 0 ? `Rank #${commissionRank}` : undefined
                    }
                  />
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/70">
                <CardHeader>
                  <CardTitle>Technical identity</CardTitle>
                  <CardDescription>
                    Public addresses and keys useful for explorer/debug views.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MetadataRow
                    label="Staking pool id"
                    value={
                      validator.stakingPoolId
                        ? formatAddress(validator.stakingPoolId, 10)
                        : '—'
                    }
                  />
                  <Separator />
                  <MetadataRow
                    label="Operation cap"
                    value={
                      validator.operationCapId
                        ? formatAddress(validator.operationCapId, 10)
                        : '—'
                    }
                  />
                  <Separator />
                  <MetadataRow
                    label="Activation epoch"
                    value={validator.stakingPoolActivationEpoch ?? '—'}
                  />
                  <Separator />
                  <MetadataRow
                    label="Protocol pubkey"
                    value={
                      validator.protocolPubkey
                        ? formatAddress(validator.protocolPubkey, 10)
                        : '—'
                    }
                  />
                  <Separator />
                  <MetadataRow
                    label="Network pubkey"
                    value={
                      validator.networkPubkey
                        ? formatAddress(validator.networkPubkey, 10)
                        : '—'
                    }
                  />
                  <Separator />
                  <MetadataRow
                    label="Worker pubkey"
                    value={
                      validator.workerPubkey
                        ? formatAddress(validator.workerPubkey, 10)
                        : '—'
                    }
                  />
                  <Separator />
                  <MetadataRow
                    label="Proof of possession"
                    value={
                      validator.proofOfPossession
                        ? formatAddress(validator.proofOfPossession, 10)
                        : '—'
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
              <Card className="border-border/50 bg-card/70">
                <CardHeader>
                  <CardTitle>Stake events</CardTitle>
                  <CardDescription>
                    The table shell is ready for filtered `iotax_queryEvents`
                    integration.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                    No indexed stake events available yet for{' '}
                    {formatAddress(validator.iotaAddress)}.
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/70">
                <CardHeader>
                  <CardTitle>Network endpoints</CardTitle>
                  <CardDescription>
                    Endpoint fields published by the validator object.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MetadataRow
                    label="Validator net"
                    value={validator.netAddress || '—'}
                  />
                  <Separator />
                  <MetadataRow
                    label="P2P"
                    value={validator.p2pAddress || '—'}
                  />
                  <Separator />
                  <MetadataRow
                    label="Primary"
                    value={validator.primaryAddress || '—'}
                  />
                  <Separator />
                  <MetadataRow
                    label="Worker"
                    value={validator.workerAddress || '—'}
                  />
                  <Separator />
                  <MetadataRow
                    label="Geo"
                    value={
                      hasGeo
                        ? `${validator.lat?.toFixed(3)}, ${validator.lng?.toFixed(
                            3
                          )}`
                        : '—'
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button className="w-full" disabled>
            Wallet integration coming soon
          </Button>
        </div>
      </section>
    </main>
  );
}
