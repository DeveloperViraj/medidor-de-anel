/**
 * Screen calibration: how many CSS pixels make a millimetre on this screen.
 *
 * A browser cannot know the physical size of its screen, so the person matches an on-screen shape
 * to an object of known size and we divide. All lengths are CSS pixels: they stay constant while
 * the page is open, unlike device pixels, and the measuring shapes are drawn in px (never rem) so
 * Android's font scaling cannot resize them.
 */

/** ISO/IEC 7810 ID-1, the size of every bank, transport and health-plan card. */
export const CARD_LONG_MM = 85.6;
export const CARD_SHORT_MM = 53.98;

/**
 * Banco Central do Brasil, second family of Real coins: the R$ 1 is 27.00 mm across in both the
 * 1998-2001 and the 2002-onwards versions. https://www.bcb.gov.br/dinheirobrasileiro/segunda-familia-moedas.html
 */
export const COIN_R1_MM = 27;

export type CalibrationMethod = 'card' | 'coin' | 'ruler';

/**
 * Phones sit around 5-7 px/mm, desktop monitors around 3-4.5. Outside 2-14 the shape was not
 * matched to the object (a slider left at an extreme), so the value is refused.
 */
export const MIN_PX_PER_MM = 2;
export const MAX_PX_PER_MM = 14;

export const isPlausiblePxPerMm = (pxPerMm: number): boolean =>
  Number.isFinite(pxPerMm) && pxPerMm >= MIN_PX_PER_MM && pxPerMm <= MAX_PX_PER_MM;

export const pxPerMmFrom = (lengthPx: number, lengthMm: number): number => lengthPx / lengthMm;

/**
 * What the calibration depends on. If any of it changes (browser zoom, a different screen, the
 * phone's display zoom), the stored px/mm no longer holds and the person is asked to check again.
 */
export interface ScreenFingerprint {
  /** devicePixelRatio: changes with desktop browser zoom (Chrome, Edge, Firefox). */
  dpr: number;
  /** screen.width/height sorted, so rotating the phone does not count as a change. */
  shortSide: number;
  longSide: number;
  /**
   * Phones only: CSS viewport width divided by the screen width in the same orientation. Safari's
   * page zoom changes this without touching devicePixelRatio. Null on desktops, where resizing the
   * window changes it too.
   */
  viewportRatio: number | null;
}

export interface Calibration {
  pxPerMm: number;
  method: CalibrationMethod;
  screen: ScreenFingerprint;
}

export function sameScreen(a: ScreenFingerprint, b: ScreenFingerprint): boolean {
  const near = (x: number, y: number, tolerance: number) => Math.abs(x - y) <= tolerance;
  if (!near(a.dpr, b.dpr, 0.01)) return false;
  if (!near(a.shortSide, b.shortSide, 1) || !near(a.longSide, b.longSide, 1)) return false;
  if (a.viewportRatio !== null && b.viewportRatio !== null) {
    // Two percent covers scrollbars appearing; Safari's zoom steps are at least 10%.
    return near(a.viewportRatio, b.viewportRatio, 0.02);
  }
  return true;
}

/** Validates data read back from storage, which may be old, edited or from another version. */
export function parseCalibration(value: unknown): Calibration | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const screen = v.screen as Record<string, unknown> | undefined;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const pxPerMm = num(v.pxPerMm);
  if (pxPerMm === null || !isPlausiblePxPerMm(pxPerMm)) return null;
  if (v.method !== 'card' && v.method !== 'coin' && v.method !== 'ruler') return null;
  if (!screen) return null;
  const dpr = num(screen.dpr);
  const shortSide = num(screen.shortSide);
  const longSide = num(screen.longSide);
  const viewportRatio = screen.viewportRatio === null ? null : num(screen.viewportRatio);
  if (dpr === null || shortSide === null || longSide === null) return null;
  if (viewportRatio === null && screen.viewportRatio !== null) return null;
  return { pxPerMm, method: v.method, screen: { dpr, shortSide, longSide, viewportRatio } };
}
