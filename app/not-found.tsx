import Link from 'next/link';
import { Compass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/page-shell';

export default function NotFound() {
  return (
    <PageShell sectionClassName="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg border bg-card/70 text-primary">
          <Compass className="size-5" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-normal">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This route is not available in the explorer. You can return to the
          dashboard or continue with validator research.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button render={<Link href="/" />}>Home</Button>
          <Button variant="outline" render={<Link href="/validators" />}>
            Validators
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
