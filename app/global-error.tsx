'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import './globals.css';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-lg border bg-card text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <title>IOTA Explorer error</title>
            <h1 className="mt-6 text-3xl font-semibold tracking-normal">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The explorer hit an unexpected rendering error. Try again to
              reload the current view.
            </p>
            <Button className="mt-6" onClick={() => unstable_retry()}>
              Try again
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
