import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PageShellProps = {
  children: ReactNode;
  mainClassName?: string;
  sectionClassName?: string;
};

export function PageShell({
  children,
  mainClassName,
  sectionClassName,
}: PageShellProps) {
  return (
    <main className={cn('min-h-screen pt-28', mainClassName)}>
      <section
        className={cn('mx-auto w-full max-w-7xl px-4 pb-20', sectionClassName)}
      >
        {children}
      </section>
    </main>
  );
}
