import type { ComponentType, ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type MetricCardVariant = 'info' | 'stat';

type MetricCardProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sub?: string | ReactNode;
  variant?: MetricCardVariant;
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  variant = 'info',
}: MetricCardProps) {
  const isStat = variant === 'stat';

  return (
    <Card
      className={cn(
        'border-border/50',
        isStat ? 'bg-card/50 backdrop-blur-sm' : 'bg-card/70'
      )}
    >
      <CardContent
        className={cn(
          'flex',
          isStat ? 'items-center gap-4 p-4' : 'items-start gap-3 py-1'
        )}
      >
        <div
          className={cn(
            'rounded-lg bg-primary/10 text-primary',
            isStat
              ? 'flex h-10 w-10 shrink-0 items-center justify-center'
              : 'p-2'
          )}
        >
          <Icon className={cn(isStat ? 'h-5 w-5' : 'size-4')} />
        </div>
        <div className={cn('min-w-0', isStat && 'flex-1')}>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              'truncate text-lg',
              isStat
                ? 'font-bold tracking-tight'
                : 'mt-1 font-mono font-semibold'
            )}
          >
            {value}
          </p>
          {sub && (
            <p
              className={cn('text-xs text-muted-foreground', !isStat && 'mt-1')}
            >
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
