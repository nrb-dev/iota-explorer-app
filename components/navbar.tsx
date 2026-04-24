import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { MenuIcon, MoveRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { ThemeToggle } from './themeToggle';

export function Navbar() {
  return (
    <header className="bg-transoarent absolute top-0 left-0 z-50 flex items-center justify-between w-full px-2 mt-4">
      <Link href="/">
        <Image
          src="./logo.svg"
          alt="Synthetify Logo"
          width={45}
          height={45}
          className="dark:invert"
        />
      </Link>

      <NavigationMenu className="bg-background rounded-sm p-1 hidden sm:flex">
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink render={<Link href="/">Home</Link>} />
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              render={<Link href="/validators">Validators</Link>}
            />
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink render={<Link href="/charts">Charts</Link>} />
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink render={<Link href="/staking">Staking</Link>} />
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" className="rounded-sm p-5" />}
          className="border-0 !bg-background cursor-pointer"
        >
          <MenuIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup className="sm:hidden">
            <DropdownMenuItem>
              <Link href="/" className="flex items-center gap-2">
                Home
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href="/validators" className="flex items-center gap-2">
                Validators
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href="/charts" className="flex items-center gap-2">
                Charts
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href="/staking" className="flex items-center gap-2">
                Staking
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="flex sm:hidden" />

          <DropdownMenuGroup>
            <DropdownMenuItem>
              <ThemeToggle />
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem>Latency: 50ms</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
