import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { Activity, BarChart3, Landmark, MenuIcon, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { NetworkControls } from './network-controls';
import { GlobeControls } from './globe/globe-controls';

const navItems = [
  { href: '/', label: 'Home', icon: Activity },
  { href: '/validators', label: 'Validators', icon: Users },
  { href: '/charts', label: 'Charts', icon: BarChart3 },
  { href: '/staking', label: 'Staking', icon: Landmark },
];

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 p-4 z-50 border-b border-border/40 bg-linear-to-b from-background/50 via-background/70 to-background/10 backdrop-blur-md supports-backdrop-filter:bg-linear-to-b">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between xl:px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="IOTA Explorer logo"
            width={45}
            height={45}
            priority
            className="h-auto dark:invert"
          />
          <span>IOTA Explorer</span>
        </Link>

        <NavigationMenu className="bg-background rounded-sm p-1 hidden sm:flex">
          <NavigationMenuList>
            {navItems.map(({ href, label }) => (
              <NavigationMenuItem key={href}>
                <NavigationMenuLink render={<Link href={href}>{label}</Link>} />
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-lg"
                className="rounded-sm"
                aria-label="Open navigation menu"
              />
            }
            className="border-0 bg-background! cursor-pointer"
          >
            <MenuIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 min-w-56">
            <DropdownMenuGroup className="sm:hidden">
              <DropdownMenuLabel className="px-2">Navigation</DropdownMenuLabel>
              {navItems.map(({ href, label, icon: Icon }) => (
                <DropdownMenuItem key={href} className="h-8 px-2">
                  <Link href={href} className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4" />
                    <span className="truncate">{label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="flex sm:hidden" />

            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2">
                Preferences
              </DropdownMenuLabel>
              <DropdownMenuItem className="p-0">
                <ThemeToggle />
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <GlobeControls />

            <DropdownMenuSeparator />

            <NetworkControls />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
