// Shown the moment a link is clicked, while the server prepares the page.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Wczytywanie" className="animate-pulse">
      <div className="h-8 w-56 rounded-xl bg-surface-2" />
      <div className="mt-3 h-4 w-80 max-w-full rounded-lg bg-surface-2" />
      <div className="mt-8 grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-[22px] border border-border bg-surface/60" />
        ))}
      </div>
    </div>
  );
}
