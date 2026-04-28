import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/page-shell';

export default function LoadingValidatorDetail() {
  return (
    <PageShell>
      <Skeleton className="mb-4 h-8 w-28" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-96 w-full rounded-xl" />
    </PageShell>
  );
}
