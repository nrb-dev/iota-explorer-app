import Image from 'next/image';

export function Footer() {
  return (
    <footer className="w-full mx-auto z-0 max-w-7xl flex items-center gap-4 px-4 justify-center ">
      <Image
        src="./logo.svg"
        alt="Website Logo"
        width={45}
        height={45}
        className="dark:invert"
      />
      <span>Community-driven tool for validators on the IOTA network.</span>
    </footer>
  );
}
