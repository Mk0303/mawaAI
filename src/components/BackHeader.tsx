import Link from "next/link";
export function BackHeader({ title, href = "/" }: { title: string; href?: string }) {
  return (
    <header className="safe-top flex items-center gap-3 px-4 pb-3">
      <Link href={href} aria-label="Back" className="grid h-10 w-10 place-items-center t-btn border border-white/10 bg-white/[0.04] active:scale-95">←</Link>
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
