import Image from 'next/image';
import Link from 'next/link';
import { Activity, BarChart3, ExternalLink, Landmark, Users } from 'lucide-react';

import { Separator } from '@/components/ui/separator';

const productLinks = [
  { href: '/', label: 'Home', icon: Activity },
  { href: '/validators', label: 'Validators', icon: Users },
  { href: '/charts', label: 'Network Charts', icon: BarChart3 },
  { href: '/staking', label: 'Staking', icon: Landmark },
];

const resourceLinks = [
  { href: 'https://www.iota.org/', label: 'IOTA' },
  { href: 'https://docs.iota.org/', label: 'Docs' },
  { href: 'https://explorer.iota.org/', label: 'Official Explorer' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-12 border-t border-border/50 bg-background/45 backdrop-blur-sm">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.6fr)_minmax(180px,0.6fr)]">
        <div className="max-w-xl">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="IOTA Explorer logo"
              width={42}
              height={42}
              className="h-auto dark:invert"
            />
            <span className="text-base font-semibold">IOTA Explorer</span>
          </Link>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Community-driven explorer for validator research, network activity,
            staking context, and recent IOTA chain data.
          </p>
          <p className="mt-3 max-w-lg text-xs leading-5 text-muted-foreground">
            Data is fetched from public IOTA RPC methods and refreshed
            periodically. Values are informational and may lag the latest chain
            state.
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <h2 className="text-sm font-medium">Explore</h2>
          <ul className="mt-4 space-y-3">
            {productLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="IOTA resources">
          <h2 className="text-sm font-medium">Resources</h2>
          <ul className="mt-4 space-y-3">
            {resourceLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {label}
                  <ExternalLink className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <Separator className="mx-auto max-w-7xl" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} IOTA Explorer. Built for transparent network research.</p>
        <p className="font-mono">mainnet / testnet aware</p>
      </div>
    </footer>
  );
}
