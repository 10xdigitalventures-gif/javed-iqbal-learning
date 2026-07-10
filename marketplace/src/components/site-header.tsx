import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight text-slate-900"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">
            10X
          </span>
          <span>Marketplace</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
          <Link href="/" className="hover:text-slate-900">
            Experts
          </Link>
          <Link
            href="/onboard"
            className="rounded-lg bg-brand px-3 py-1.5 text-white transition hover:bg-brand-dark"
          >
            Become an expert
          </Link>
        </nav>
      </div>
    </header>
  );
}
