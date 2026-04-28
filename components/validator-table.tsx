'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  ChevronDown,
} from 'lucide-react';

import {
  formatIota,
  formatApy,
  formatCommission,
  formatVotingPower,
} from '@/lib/formatters';
import { ValidatorAvatar } from '@/components/validators/validator-avatar';
import { MetricCard } from '@/components/metric-card';
import { TableSkeleton } from '@/components/validators/table-skeleton';
import { TablePagination } from '@/components/validators/table-pagination';
import { useNetworkStore, withNetworkParam } from '@/lib/network-store';
import {
  SortableHeader,
  type SortDir,
} from '@/components/validators/sortable-header';
import { cn } from '@/lib/utils';

const VALIDATORS_PAGE_SIZE = 12;
const GROUP_PAGE_SIZE = 10;

type CountryGroupRow = {
  country: string;
  count: number;
  validators: Validator[];
  totalStake: number;
  avgApy: number | null;
};

type RegionGroupRow = {
  region: string;
  count: number;
  validators: Validator[];
  totalStake: number;
  countries: number;
  avgApy: number | null;
};

function clampPage(page: number, totalItems: number, pageSize: number): number {
  return Math.min(
    Math.max(1, page),
    Math.max(1, Math.ceil(totalItems / pageSize))
  );
}

function sortValidatorsByStake(validators: Validator[]): Validator[] {
  return [...validators].sort(
    (a, b) =>
      Number(b.stakingPoolIotaBalance) - Number(a.stakingPoolIotaBalance)
  );
}

function getAverageApy(validators: Validator[]): number | null {
  const withApy = validators.filter((v) => v.apy != null);
  if (withApy.length === 0) return null;
  return withApy.reduce((sum, v) => sum + (v.apy ?? 0), 0) / withApy.length;
}

function GroupValidatorsGrid({
  validators,
  totalVotingPower,
  onOpenValidator,
}: {
  validators: Validator[];
  totalVotingPower: number;
  onOpenValidator: (address: string) => void;
}) {
  return (
    <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {validators.map((validator) => (
        <button
          key={validator.iotaAddress || validator.name}
          type="button"
          className="flex min-w-0 items-center gap-3 rounded-lg border bg-background/60 p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onOpenValidator(validator.iotaAddress)}
        >
          <ValidatorAvatar
            name={validator.name}
            imageUrl={validator.imageUrl}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{validator.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatIota(validator.stakingPoolIotaBalance)} IOTA ·{' '}
              {formatApy(validator.apy)}
            </p>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            {formatVotingPower(validator.votingPower, totalVotingPower)}
          </Badge>
        </button>
      ))}
    </div>
  );
}

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
  className,
}: {
  validators: Validator[];
  epoch: string;
  totalStake: string;
  isLoading: boolean;
  className?: string;
}) {
  const router = useRouter();
  const network = useNetworkStore((state) => state.network);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('stake');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [validatorsPage, setValidatorsPage] = useState(1);
  const [countryPage, setCountryPage] = useState(1);
  const [regionPage, setRegionPage] = useState(1);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

  const totalVotingPower = useMemo(
    () => validators.reduce((sum, v) => sum + v.votingPower, 0),
    [validators]
  );

  const avgApy = useMemo(() => {
    return getAverageApy(validators);
  }, [validators]);

  const uniqueCountries = useMemo(
    () => new Set(validators.map((v) => v.country)).size,
    [validators]
  );

  const handleSort = (field: SortField) => {
    setValidatorsPage(1);
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
        validators: sortValidatorsByStake(vals),
        totalStake: vals.reduce(
          (sum, v) => sum + Number(v.stakingPoolIotaBalance),
          0
        ),
        avgApy: getAverageApy(vals),
      }))
      .sort((a, b) => b.totalStake - a.totalStake);
  }, [validators]) satisfies CountryGroupRow[];

  const byRegion = useMemo(() => {
    const map = new Map<string, Validator[]>();
    for (const v of validators) {
      const list = map.get(v.region) ?? [];
      list.push(v);
      map.set(v.region, list);
    }
    return Array.from(map.entries())
      .map(([region, vals]) => ({
        region,
        count: vals.length,
        validators: sortValidatorsByStake(vals),
        totalStake: vals.reduce(
          (sum, v) => sum + Number(v.stakingPoolIotaBalance),
          0
        ),
        countries: new Set(vals.map((v) => v.country)).size,
        avgApy: getAverageApy(vals),
      }))
      .sort((a, b) => b.totalStake - a.totalStake);
  }, [validators]) satisfies RegionGroupRow[];

  const paginatedValidators = useMemo(() => {
    const page = clampPage(
      validatorsPage,
      filtered.length,
      VALIDATORS_PAGE_SIZE
    );
    const start = (page - 1) * VALIDATORS_PAGE_SIZE;
    return filtered.slice(start, start + VALIDATORS_PAGE_SIZE);
  }, [filtered, validatorsPage]);

  const paginatedCountries = useMemo(() => {
    const page = clampPage(countryPage, byCountry.length, GROUP_PAGE_SIZE);
    const start = (page - 1) * GROUP_PAGE_SIZE;
    return byCountry.slice(start, start + GROUP_PAGE_SIZE);
  }, [byCountry, countryPage]);

  const paginatedRegions = useMemo(() => {
    const page = clampPage(regionPage, byRegion.length, GROUP_PAGE_SIZE);
    const start = (page - 1) * GROUP_PAGE_SIZE;
    return byRegion.slice(start, start + GROUP_PAGE_SIZE);
  }, [byRegion, regionPage]);

  const currentValidatorsPage = clampPage(
    validatorsPage,
    filtered.length,
    VALIDATORS_PAGE_SIZE
  );
  const currentCountryPage = clampPage(
    countryPage,
    byCountry.length,
    GROUP_PAGE_SIZE
  );
  const currentRegionPage = clampPage(
    regionPage,
    byRegion.length,
    GROUP_PAGE_SIZE
  );

  const openValidator = (address: string) => {
    if (!address) return;
    router.push(
      withNetworkParam(`/validators/${encodeURIComponent(address)}`, network)
    );
  };

  const renderExpandedValidators = (
    validators: Validator[],
    colSpan: number
  ) => (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="bg-muted/20 p-0">
        <GroupValidatorsGrid
          validators={validators}
          totalVotingPower={totalVotingPower}
          onOpenValidator={openValidator}
        />
      </TableCell>
    </TableRow>
  );

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
      className={cn('relative mx-auto w-full max-w-7xl px-4 pb-8', className)}
    >
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <MetricCard
          variant="stat"
          icon={Users}
          label="Active Validators"
          value={String(validators.length)}
          sub={`Epoch #${epoch}`}
        />
        <MetricCard
          variant="stat"
          icon={Coins}
          label="Total Staked"
          value={`${formatIota(totalStake)} IOTA`}
        />
        <MetricCard
          variant="stat"
          icon={TrendingUp}
          label="Average APY"
          value={avgApy != null ? formatApy(avgApy) : '—'}
        />
        <MetricCard
          variant="stat"
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
          <TabsTrigger value="regions">By Region</TabsTrigger>
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
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setValidatorsPage(1);
                    }}
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
                    paginatedValidators.map((v, i) => {
                      const rowNumber =
                        (currentValidatorsPage - 1) * VALIDATORS_PAGE_SIZE +
                        i +
                        1;

                      return (
                        <TableRow
                          key={v.iotaAddress || v.name}
                          role={v.iotaAddress ? 'link' : undefined}
                          tabIndex={v.iotaAddress ? 0 : undefined}
                          className="group cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                          onClick={() => openValidator(v.iotaAddress)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openValidator(v.iotaAddress);
                            }
                          }}
                        >
                          <TableCell className="text-center text-xs text-muted-foreground font-mono">
                            {rowNumber}
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
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
                                aria-label={`Visit ${v.name} website`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <TablePagination
                page={currentValidatorsPage}
                pageSize={VALIDATORS_PAGE_SIZE}
                totalItems={filtered.length}
                onPageChange={setValidatorsPage}
              />
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
                  {paginatedCountries.map((row, i) => {
                    const isExpanded = expandedCountry === row.country;

                    return (
                      <Fragment key={row.country}>
                        <TableRow
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                          onClick={() =>
                            setExpandedCountry((current) =>
                              current === row.country ? null : row.country
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setExpandedCountry((current) =>
                                current === row.country ? null : row.country
                              );
                            }
                          }}
                        >
                          <TableCell className="text-center text-xs text-muted-foreground font-mono">
                            {(currentCountryPage - 1) * GROUP_PAGE_SIZE + i + 1}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                className={`size-4 text-muted-foreground transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                              {row.country}
                            </div>
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
                              variant={
                                row.avgApy != null ? 'default' : 'secondary'
                              }
                              className="font-mono text-xs"
                            >
                              {formatApy(row.avgApy)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded &&
                          renderExpandedValidators(row.validators, 5)}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                page={currentCountryPage}
                pageSize={GROUP_PAGE_SIZE}
                totalItems={byCountry.length}
                onPageChange={setCountryPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── By Region tab ── */}
        <TabsContent value="regions">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Validators by Region
                <Badge variant="secondary" className="ml-2 font-mono text-xs">
                  {byRegion.length} regions
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Countries</TableHead>
                    <TableHead className="text-right">Validators</TableHead>
                    <TableHead className="text-right">Total Stake</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">
                      Avg APY
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRegions.map((row, i) => {
                    const isExpanded = expandedRegion === row.region;

                    return (
                      <Fragment key={row.region}>
                        <TableRow
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                          onClick={() =>
                            setExpandedRegion((current) =>
                              current === row.region ? null : row.region
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setExpandedRegion((current) =>
                                current === row.region ? null : row.region
                              );
                            }
                          }}
                        >
                          <TableCell className="text-center text-xs text-muted-foreground font-mono">
                            {(currentRegionPage - 1) * GROUP_PAGE_SIZE + i + 1}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                className={`size-4 text-muted-foreground transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                              {row.region}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.countries}
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
                              variant={
                                row.avgApy != null ? 'default' : 'secondary'
                              }
                              className="font-mono text-xs"
                            >
                              {formatApy(row.avgApy)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded &&
                          renderExpandedValidators(row.validators, 6)}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                page={currentRegionPage}
                pageSize={GROUP_PAGE_SIZE}
                totalItems={byRegion.length}
                onPageChange={setRegionPage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
