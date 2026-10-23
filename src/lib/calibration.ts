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
 *
 * The limits apply to pixels as they appear on screen: CSS px times the page zoom. A phone browser
 * in "desktop site" mode lays the page out about 980 px wide and shrinks it to fit (zoom ≈ 0.37), so
 * a millimetre there takes almost three times as many CSS px.
 */
export const MIN_PX_PER_MM = 2;
export const MAX_PX_PER_MM = 14;

export function isPlausiblePxPerMm(pxPerMm: number, zoom = 1): boolean {
  const onScreen = pxPerMm * zoom;
  return Number.isFinite(onScreen) && onScreen >= MIN_PX_PER_MM && onScreen <= MAX_PX_PER_MM;
}

/**
 * The slider's range, in on-screen px per mm. Phones and tablets run 4.5-6.6 in practice (a 2x
 * iPhone is 6.4, a low-cost 720p Android about 5.3). Computers run 3.5-6.5: big monitors 3.5-4.8,
 * MacBooks about 5.1, and the densest common case is a 13-14" Full HD laptop at 100% scaling
 * (157-166 ppi, 6.2-6.5). The margins cover unusual screens; on a computer the cap of 7 also keeps
 * a flat card (599 px) inside the 686 px tool column.
 */
export function onScreenRange(touch: boolean): { min: number; max: number } {
  return touch ? { min: 4, max: 8 } : { min: 2.5, max: 7 };
}

export interface CardLayout {
  orientation: 'upright' | 'landscape';
  /** Largest CSS px per mm the slider may reach, so the outline never leaves the stage. */
  maxPxPerMm: number;
  /** True when the stage, not the device range, sets the limit (small screens). */
  limitedByScreen: boolean;
}

/**
 * How to draw the calibration card in a stage with `roomPx` CSS px across. The card lies flat
 * only if its 85.6 mm long side fits at every value the slider can reach (computers, phones held
 * sideways). Otherwise it stands upright, 53.98 mm across, and the slider stops where the outline
 * would leave the stage, so it can never spill out.
 */
export function cardLayout(roomPx: number, maxPxPerMm: number): CardLayout {
  if (roomPx / CARD_LONG_MM >= maxPxPerMm) {
    return { orientation: 'landscape', maxPxPerMm, limitedByScreen: false };
  }
  const fit = roomPx / CARD_SHORT_MM;
  return {
    orientation: 'upright',
    maxPxPerMm: Math.min(maxPxPerMm, fit),
    limitedByScreen: fit < maxPxPerMm,
  };
}

/** Zoom values a browser can really have; anything else in storage is corrupt. */
const isPlausibleZoom = (zoom: number): boolean =>
  Number.isFinite(zoom) && zoom >= 0.1 && zoom <= 10;

/**
 * Pinch-zoom (or leaving desktop-site mode) scales everything drawn on the page, so shapes stop
 * being true to size until the zoom is back where the calibration was made. Two percent absorbs
 * rounding in the browser's reported scale.
 */
export const zoomMoved = (calibrationZoom: number, currentZoom: number): boolean =>
  Math.abs(currentZoom / calibrationZoom - 1) > 0.02;

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
  /** CSS px per mm at the zoom below. */
  pxPerMm: number;
  method: CalibrationMethod;
  screen: ScreenFingerprint;
  /** The page zoom (visualViewport.scale) when the calibration was made: 1 unless desktop-site mode. */
  zoom: number;
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
  // Calibrations saved before the zoom was recorded were all made at the normal zoom of 1.
  const zoom = v.zoom === undefined ? 1 : num(v.zoom);
  if (zoom === null || !isPlausibleZoom(zoom)) return null;
  const pxPerMm = num(v.pxPerMm);
  if (pxPerMm === null || !isPlausiblePxPerMm(pxPerMm, zoom)) return null;
  if (v.method !== 'card' && v.method !== 'coin' && v.method !== 'ruler') return null;
  if (!screen) return null;
  const dpr = num(screen.dpr);
  const shortSide = num(screen.shortSide);
  const longSide = num(screen.longSide);
  const viewportRatio = screen.viewportRatio === null ? null : num(screen.viewportRatio);
  if (dpr === null || shortSide === null || longSide === null) return null;
  if (viewportRatio === null && screen.viewportRatio !== null) return null;
  return {
    pxPerMm,
    method: v.method,
    screen: { dpr, shortSide, longSide, viewportRatio },
    zoom,
  };
}
