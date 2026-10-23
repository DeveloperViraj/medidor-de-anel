/**
 * The logo: a gold solitaire on a garnet tile. One SVG source feeds the header, the favicon and the
 * app icons, so they can never drift apart. Plain hex colours because sharp renders the icons.
 */

export const BRAND = {
  tile: '#7f1f33',
  gold: '#e2b552',
  gem: '#ffffff',
} as const;

export function logoSvg({ rx = 15 }: { rx?: number } = {}): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Medidor de Anel">',
    `<rect width="64" height="64" rx="${rx}" fill="${BRAND.tile}"/>`,
    `<circle cx="32" cy="37" r="14.5" fill="none" stroke="${BRAND.gold}" stroke-width="5"/>`,
    `<path d="M32 9.5 39 16.5 32 23.5 25 16.5Z" fill="${BRAND.gem}"/>`,
    `<path d="M25 16.5h14" stroke="${BRAND.tile}" stroke-opacity=".28" stroke-width="1.2"/>`,
    '</svg>',
  ].join('');
}
