'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Validator } from '@/components/globe/types';
import {
  Search,
  Globe2,
  Coins,
  TrendingUp,
  Users,
  ExternalLink,
} from 'lucide-react';

import {
  formatIota,
  formatApy,
  formatCommission,
  formatVotingPower,
} from '@/lib/formatters';
import { ValidatorAvatar } from '@/components/validators/validator-avatar';
import { StatCard } from '@/components/validators/stat-card';
import { TableSkeleton } from '@/components/validators/table-skeleton';
import {
  SortableHeader,
  type SortDir,
} from '@/components/validators/sortable-header';

/* ── Sorting ── */
export type SortField =
  | 'name'
  | 'stake'
  | 'votingPower'
  | 'apy'
  | 'commission'
  | 'country';

function getSortValue(v: Validator, field: SortField): number | string {
  switch (field) {
    case 'name':
      return v.name.toLowerCase();
    case 'stake':
      return Number(v.stakingPoolIotaBalance);
    case 'votingPower':
      return v.votingPower;
    case 'apy':
      return v.apy ?? -1;
    case 'commission':
      return v.commissionRate;
    case 'country':
      return v.country.toLowerCase();
  }
}

/* ── Main component ── */
export function ValidatorTable({
  validators,
  epoch,
  totalStake,
  isLoading,
}: {
  validators: Validator[];
  epoch: string;
  totalStake: string;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('stake');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const totalVotingPower = useMemo(
    () => validators.reduce((sum, v) => sum + v.votingPower, 0),
    [validators]
  );

  const avgApy = useMemo(() => {
    const withApy = validators.filter((v) => v.apy != null);
    if (withApy.length === 0) return null;
    return withApy.reduce((sum, v) => sum + (v.apy ?? 0), 0) / withApy.length;
  }, [validators]);

  const uniqueCountries = useMemo(
    () => new Set(validators.map((v) => v.country)).size,
    [validators]
  );

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' || field === 'country' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = validators;
    if (q) {
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.country.toLowerCase().includes(q) ||
          v.city.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      const cmp =
        typeof aVal === 'string'
          ? aVal.localeCompare(bVal as string)
          : (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [validators, search, sortField, sortDir]);

  // Group by country for geography tab
  const byCountry = useMemo(() => {
    const map = new Map<string, Validator[]>();
    for (const v of validators) {
      const list = map.get(v.country) ?? [];
      list.push(v);
      map.set(v.country, list);
    }
    return Array.from(map.entries())
      .map(([country, vals]) => ({
        country,
        count: vals.length,
        totalStake: vals.reduce(
          (sum, v) => sum + Number(v.stakingPoolIotaBalance),
          0
        ),
        avgApy:
          vals.filter((v) => v.apy != null).length > 0
            ? vals.reduce((sum, v) => sum + (v.apy ?? 0), 0) /
              vals.filter((v) => v.apy != null).length
            : null,
      }))
      .sort((a, b) => b.totalStake - a.totalStake);
  }, [validators]);

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 pb-16">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <TableSkeleton />
        </Card>
      </section>
    );
  }

  return (
    <section
      id="validator-tables"
      className="mx-auto w-full max-w-7xl px-4 pb-8 sm:-top-20"
    >
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <StatCard
          icon={Users}
          label="Active Validators"
          value={String(validators.length)}
          sub={`Epoch #${epoch}`}
        />
        <StatCard
          icon={Coins}
          label="Total Staked"
          value={`${formatIota(totalStake)} IOTA`}
        />
        <StatCard
          icon={TrendingUp}
          label="Average APY"
          value={avgApy != null ? formatApy(avgApy) : '—'}
        />
        <StatCard
          icon={Globe2}
          label="Countries"
          value={String(uniqueCountries)}
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="validators" className="w-full">
        <TabsList className="mb-4 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="validators">All Validators</TabsTrigger>
          <TabsTrigger value="geography">By Country</TabsTrigger>
        </TabsList>

        {/* ── All Validators tab ── */}
        <TabsContent value="validators">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold">
                  Validators
                  <Badge variant="secondary" className="ml-2 font-mono text-xs">
                    {filtered.length}
                  </Badge>
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="validator-search"
                    placeholder="Search validators..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background/50"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Validator"
                        field="name"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <SortableHeader
                        label="Country"
                        field="country"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        label="Stake"
                        field="stake"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                    </TableHead>
                    <TableHead className="hidden sm:table-cell text-right">
                      <SortableHeader
                        label="Voting Power"
                        field="votingPower"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        label="APY"
                        field="apy"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-right">
                      <SortableHeader
                        label="Commission"
                        field="commission"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-right w-10">
                      <span className="sr-only">Link</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No validators found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((v, i) => (
                      <TableRow key={v.iotaAddress || v.name} className="group">
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ValidatorAvatar
                              name={v.name}
                              imageUrl={v.imageUrl}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-sm">
                                {v.name}
                              </p>
                              {v.city && (
                                <p className="truncate text-xs text-muted-foreground md:hidden">
                                  {v.city}, {v.country}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {v.city ? `${v.city}, ` : ''}
                            {v.country}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatIota(v.stakingPoolIotaBalance)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right font-mono text-sm">
                          {formatVotingPower(v.votingPower, totalVotingPower)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              v.apy != null && v.apy > 0
                                ? 'default'
                                : 'secondary'
                            }
                            className="font-mono text-xs"
                          >
                            {formatApy(v.apy)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right font-mono text-sm text-muted-foreground">
                          {formatCommission(v.commissionRate)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right">
                          {v.projectUrl && (
                            <a
                              href={v.projectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
                              aria-label={`Visit ${v.name} website`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── By Country tab ── */}
        <TabsContent value="geography">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Validators by Country
                <Badge variant="secondary" className="ml-2 font-mono text-xs">
                  {byCountry.length} countries
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Validators</TableHead>
                    <TableHead className="text-right">Total Stake</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">
                      Avg APY
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCountry.map((row, i) => (
                    <TableRow key={row.country}>
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {row.country}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          {row.count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatIota(String(row.totalStake))}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right">
                        <Badge
                          variant={row.avgApy != null ? 'default' : 'secondary'}
                          className="font-mono text-xs"
                        >
                          {formatApy(row.avgApy)}
                        </Badge>
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
