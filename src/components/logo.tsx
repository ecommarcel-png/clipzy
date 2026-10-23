/* eslint-disable @next/next/no-img-element -- static SVGs and hourly-signed storage URLs gain nothing from next/image */

// Brand logo uploaded by the user (or its first letter while there is none).
export function Logo({ url, name, size = 44 }: { url?: string; name: string; size?: number }) {
  return url ? (
    <img
      src={url}
      alt={`Logo ${name}`}
      width={size}
      height={size}
      className="shrink-0 rounded-xl bg-white object-contain p-1"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-accent-soft font-extrabold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

// Clipzy's own mark — drawn lettering, never typed in a font (brand guide).
export function ClipzyLogo({ variant = "horizontal", height = 28, className }: { variant?: "horizontal" | "symbol" | "stacked"; height?: number; className?: string }) {
  const ratio = variant === "horizontal" ? 795 / 238 : variant === "stacked" ? 327 / 372 : 1;
  return (
    <img
      src={`/brand/clipzy-${variant}-color-on-dark.svg`}
      alt="clipzy"
      width={Math.round(height * ratio)}
      height={height}
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
