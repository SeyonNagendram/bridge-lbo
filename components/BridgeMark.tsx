// The Bridge mark: three stepping bars (start total, step, end total, as in the value creation bridge)
// on a rounded tile. Same geometry as app/icon.svg. Colours come from the theme tokens, so in dark mode
// the tile is the light accent blue with dark bars instead of navy disappearing into the background.

export function BridgeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect width="32" height="32" rx="6" fill="var(--accent)" />
      <path fill="var(--bg)" d="M6 18h4v8H6zM14 12h4v6h-4zM22 6h4v20h-4z" />
    </svg>
  );
}
