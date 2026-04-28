'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TablePaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const end = Math.min(clampedPage * pageSize, totalItems);
  const canGoBack = clampedPage > 1;
  const canGoForward = clampedPage < totalPages;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <p className="text-sm text-muted-foreground">
        Showing{' '}
        <span className="font-mono text-foreground">{start}</span>
        {'-'}
        <span className="font-mono text-foreground">{end}</span> of{' '}
        <span className="font-mono text-foreground">{totalItems}</span>
      </p>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <p className="text-sm text-muted-foreground">
          Page{' '}
          <span className="font-mono text-foreground">{clampedPage}</span> of{' '}
          <span className="font-mono text-foreground">{totalPages}</span>
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canGoBack}
            onClick={() => onPageChange(1)}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canGoBack}
            onClick={() => onPageChange(clampedPage - 1)}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canGoForward}
            onClick={() => onPageChange(clampedPage + 1)}
            aria-label="Go to next page"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canGoForward}
            onClick={() => onPageChange(totalPages)}
            aria-label="Go to last page"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
