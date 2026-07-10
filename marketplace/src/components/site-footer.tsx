export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-slate-200 py-8">
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-slate-400">
        © {year} 10X Digital Ventures — Build Once. Scale Many Times.
      </div>
    </footer>
  );
}
