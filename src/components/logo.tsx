export function Logo({ url, name, size = 44 }: { url?: string; name: string; size?: number }) {
  return url ? (
    // Signed storage URLs change every hour; next/image optimisation adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Logo ${name}`}
      width={size}
      height={size}
      className="shrink-0 rounded-lg border border-border bg-white object-contain p-1"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-accent-soft font-semibold text-accent"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
