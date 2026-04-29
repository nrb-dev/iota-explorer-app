'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export type TransactionSeriesPoint = {
  epoch: number;
  epochLabel: string;
  transactions: number;
};

export type AddressSeriesPoint = {
  epoch: number;
  epochLabel: string;
  cumulativeAddresses: number;
  dailyActiveAddresses: number;
};

function formatBigCompact(raw: string | number | null): string {
  if (raw == null) return '—';
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} K`;
  return new Intl.NumberFormat('en').format(n);
}

const txChartConfig = {
  transactions: { label: 'Transaction blocks', color: 'var(--primary)' },
} satisfies ChartConfig;

const addressChartConfig = {
  cumulativeAddresses: { label: 'Total addresses', color: 'var(--primary)' },
} satisfies ChartConfig;

export function TransactionBlocksChart({
  data,
}: {
  data: TransactionSeriesPoint[];
}) {
  return (
    <ChartContainer config={txChartConfig} className="h-[260px] w-full">
      <AreaChart
        data={data}
        margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
      >
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
          content={<ChartTooltipContent />}
          labelFormatter={(_, payload) =>
            payload?.[0]?.payload?.epochLabel
              ? `Epoch ${payload[0].payload.epochLabel}`
              : 'Epoch'
          }
          formatter={(value) => formatBigCompact(Number(value))}
        />
        <Area
          dataKey="transactions"
          type="monotone"
          stroke="var(--color-transactions)"
          fill="var(--color-transactions)"
          fillOpacity={0.18}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function AddressesChart({ data }: { data: AddressSeriesPoint[] }) {
  return (
    <ChartContainer config={addressChartConfig} className="h-[180px] w-full">
      <LineChart
        data={data}
        margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
      >
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
          content={<ChartTooltipContent />}
          labelFormatter={(_, payload) =>
            payload?.[0]?.payload?.epochLabel
              ? `Epoch ${payload[0].payload.epochLabel}`
              : 'Epoch'
          }
          formatter={(value) => formatBigCompact(Number(value))}
        />
        <Line
          dataKey="cumulativeAddresses"
          type="monotone"
          stroke="var(--color-cumulativeAddresses)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
