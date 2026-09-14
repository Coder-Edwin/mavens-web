/**
 * The club's real logo (from mavens.co.ke, see memory `old-website-assets`),
 * replacing the ♞ glyph placeholder that stood in for it. Renders as a
 * fixed-size tile via the shared `.brand-mark` class — pass `className` only
 * to combine with it (e.g. a wrapping `<span>` vs `<div>` at each call site).
 */
export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return <span className={className}><img src="/branding/logo.png" alt="Mavens Chess Club" /></span>;
}
