import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Clock3, Database, Hash, Layers, User } from 'lucide-react';

import { CopyAddressButton } from '@/components/validators/copy-address-button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatAddress } from '@/lib/formatters';
import { getTransactionDetail, parseIotaNetwork } from '@/lib/iota';
import InfoCard from '@/components/info-card';

type Props = {
  params: Promise<{ digest: string }>;
  searchParams?: Promise<{ network?: string | string[] }>;
};

export const revalidate = 30;

function formatDate(value: string | null): string {
  if (!value) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Date(n).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatIotaCompact(raw: string | null): string {
  if (raw == null) return '—';
  const n = Number(raw) / 1_000_000_000;
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${n.toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${n.toFixed(2)}K`;
  return n.toFixed(3);
}

function statusVariant(
  status: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!status) return 'secondary';
  if (status === 'success') return 'default';
  if (status === 'failure') return 'destructive';
  return 'outline';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { digest } = await params;
  return {
    title: `${formatAddress(decodeURIComponent(digest), 10)} | Transaction`,
    description: `Transaction details for ${decodeURIComponent(digest)}`,
  };
}

export default async function TransactionDetailPage({
  params,
  searchParams,
}: Props) {
  const { digest } = await params;
  const decodedDigest = decodeURIComponent(digest);
  const resolvedSearchParams = await searchParams;
  const network = parseIotaNetwork(
    Array.isArray(resolvedSearchParams?.network)
      ? resolvedSearchParams?.network[0]
      : resolvedSearchParams?.network
  );

  const tx = await getTransactionDetail(network, decodedDigest);

  if (!tx) {
    return (
      <main className="min-h-screen pt-28">
        <section className="mx-auto w-full max-w-7xl px-4 pb-20">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            nativeButton={false}
            render={<Link href={`/?network=${network}`} />}
          >
            <ArrowLeft className="size-4" />
            Home
          </Button>
          <Card className="border-border/50 bg-card/70">
            <CardHeader>
              <CardTitle>Transaction not found</CardTitle>
              <CardDescription>
                The digest does not exist on {network} or is not available.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-28">
      <section className="mx-auto w-full max-w-7xl px-4 pb-20">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          nativeButton={false}
          render={<Link href={`/?network=${network}`} />}
        >
          <ArrowLeft className="size-4" />
          Home
        </Button>

        <Card className="border-border/50 bg-card/70 backdrop-blur-sm">
          <CardContent className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-normal">
                  Transaction
                </h1>
                <Badge variant={statusVariant(tx.status)}>
                  {tx.status ?? '—'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {tx.kind ?? 'Unknown kind'}
              </p>
            </div>
            <CopyAddressButton address={tx.digest} />
          </CardContent>
        </Card>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard
            label="Sender"
            value={
              tx.sender ? formatAddress(tx.sender, 8) : 'IOTA System Account'
            }
            sub={tx.sender ? <CopyAddressButton address={tx.sender} /> : ''}
            icon={User}
          />
          <InfoCard
            label="Checkpoint"
            value={tx.checkpoint ?? '—'}
            icon={Hash}
          />
          <InfoCard
            label="Epoch"
            value={`${tx.epoch ?? '—'}`}
            icon={Database}
          />
          <InfoCard
            label="Date"
            value={formatDate(tx.timestampMs)}
            sub={network}
            icon={Clock3}
          />
        </div>

        <Tabs defaultValue="summary" className="mt-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="object-changes">Object changes</TabsTrigger>
            <TabsTrigger value="balance-changes">Balance changes</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <Card className="border-border/50 bg-card/70">
              <CardHeader>
                <CardTitle>Execution summary</CardTitle>
                <CardDescription>
                  Key metadata and execution values from this transaction.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4 py-3 text-sm">
                  <span className="text-muted-foreground">Digest</span>
                  <span className="max-w-[70%] truncate text-right font-mono">
                    {tx.digest}
                  </span>
                </div>
                <Separator />
                <div className="flex items-start justify-between gap-4 py-3 text-sm">
                  <span className="text-muted-foreground">Kind</span>
                  <span className="max-w-[70%] truncate text-right font-mono">
                    {tx.kind ?? '—'}
                  </span>
                </div>
                <Separator />
                <div className="flex items-start justify-between gap-4 py-3 text-sm">
                  <span className="text-muted-foreground">Gas price</span>
                  <span className="max-w-[70%] truncate text-right font-mono">
                    {tx.gasPrice ?? '—'}
                  </span>
                </div>
                <Separator />
                <div className="flex items-start justify-between gap-4 py-3 text-sm">
                  <span className="text-muted-foreground">Events</span>
                  <span className="max-w-[70%] truncate text-right font-mono">
                    {tx.eventsCount}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="object-changes" className="mt-4">
            <Card className="border-border/50 bg-card/70 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="size-4" />
                  Object changes
                  <Badge variant="secondary">{tx.objectChanges.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Type</TableHead>
                      <TableHead>Object</TableHead>
                      <TableHead>Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tx.objectChanges.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-16 text-center">
                          No object changes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tx.objectChanges.map((change) => (
                        <TableRow
                          key={`${change.type}-${change.objectId}-${change.version ?? '0'}`}
                        >
                          <TableCell className="font-mono text-xs">
                            {change.type}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {formatAddress(change.objectId, 8)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {change.owner ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balance-changes" className="mt-4">
            <Card className="border-border/50 bg-card/70 overflow-hidden">
              <CardHeader>
                <CardTitle>Balance changes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Owner</TableHead>
                      <TableHead>Coin type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tx.balanceChanges.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-16 text-center">
                          No balance changes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tx.balanceChanges.map((change, index) => (
                        <TableRow
                          key={`${change.owner}-${change.coinType}-${index}`}
                        >
                          <TableCell className="font-mono text-xs">
                            {formatAddress(change.owner, 8)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {change.coinType}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {change.amount}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
