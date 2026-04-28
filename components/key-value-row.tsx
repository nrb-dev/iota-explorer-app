import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type KeyValueRowProps = {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
};

export function KeyValueRow({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}: KeyValueRowProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 py-3 text-sm', className)}
    >
      <span className={cn('text-muted-foreground', labelClassName)}>{label}</span>
      <span
        className={cn(
          'max-w-[65%] truncate text-right font-mono',
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}
