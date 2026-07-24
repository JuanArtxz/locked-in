import logoUrl from '../assets/logo.png';

/**
 * The LOCKED IN wordmark tinted by the CURRENT accent color: the PNG is used
 * as a CSS mask over a var(--color-accent) fill, so palette changes (and the
 * @property accent tween) recolor the logo live. Size it with height classes
 * (h-4, h-[26px]…) — width follows via the logo's aspect ratio.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Locked In"
      className={`pointer-events-none select-none ${className}`}
      style={{
        aspectRatio: '1690 / 373',
        backgroundColor: 'var(--color-accent)',
        WebkitMaskImage: `url(${logoUrl})`,
        maskImage: `url(${logoUrl})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
