/**
 * Ring size maths. Every size system is defined from the ring's inner circumference in mm, the
 * quantity ISO 8653:2016 uses, so one measurement converts to every scale without drift.
 *
 * Sources (read October 2026):
 * - ISO 8653:2016, "Jewellery — Ring-sizes — Definition, measurement and designation": size is the
 *   inner circumference in mm, designated rounded to the nearest mm. https://www.iso.org/standard/65408.html
 * - Brazil, aro = circumference − 40 ("scale A"): Vivara's size guide (finger 4.5 cm = aro 5 …
 *   7.0 cm = aro 30), JK Alianças ("a circunferência interna do anel em milímetros menos 40"),
 *   Gazin, Só Prata, and the goldsmith interviewed in Barreto & Souza, UFAC 2016 (aro 10 = 5.0 cm,
 *   one aro per mm). The same numbering as Italy, Spain and Switzerland.
 * - Brazil, "diameter table" ("scale B"): marketplace listings on Extra, Ponto Frio and Casas Bahia
 *   (aro 16 = 16.80 mm, aro 19 = 17.80 mm, aro 22 = 18.80 mm inner diameter), Isi Laurier, Macchi
 *   and ArtCoco. Fits diameter = 11.4667 + aro / 3 mm. About three aros above scale A for the same
 *   ring, which is why the result screen warns about it.
 * - US/Canada: diameter = 0.458 in + 0.032 in per size (Wikipedia "Ring size"; adin.be; NBS Circular
 *   43, 1921), i.e. 11.6332 mm + 0.8128 mm per size.
 * - UK/Ireland/Australia: BS 6820:1987 letters, size C = 40 mm, 1.25 mm of circumference per letter.
 *   Charts aligned to US sizes run up to 0.4 mm larger, so UK sizes are shown as approximate.
 */

/** Brazilian scale A (and Italy/Spain/Switzerland): aro = inner circumference − this. */
export const ARO_OFFSET_MM = 40;

/** Scale B: inner diameter of aro 0, and the diameter step per aro (one third of a millimetre). */
export const SCALE_B_BASE_DIAMETER_MM = 11.4667;
export const SCALE_B_STEP_DIAMETER_MM = 1 / 3;

/** US/Canada: inner diameter of size 0 (0.458 in) and the step per size (0.032 in). */
export const US_BASE_DIAMETER_MM = 0.458 * 25.4;
export const US_STEP_DIAMETER_MM = 0.032 * 25.4;

/** UK: circumference of letter A (C = 40 mm, two letters below) and the step per letter. */
export const UK_BASE_CIRCUMFERENCE_MM = 37.5;
export const UK_STEP_CIRCUMFERENCE_MM = 1.25;

/** The aros Brazilian shops actually sell (Vivara's table starts at 5; few go past 35). */
export const ARO_MIN = 5;
export const ARO_MAX = 35;

/** Measurements outside this band are not a finger: a typo or a calibration slip. */
export const MIN_CIRCUMFERENCE_MM = 38;
export const MAX_CIRCUMFERENCE_MM = 82;

export const circumferenceFromDiameter = (diameterMm: number): number => diameterMm * Math.PI;
export const diameterFromCircumference = (circumferenceMm: number): number =>
  circumferenceMm / Math.PI;

export const isPlausibleCircumference = (circumferenceMm: number): boolean =>
  Number.isFinite(circumferenceMm) &&
  circumferenceMm >= MIN_CIRCUMFERENCE_MM &&
  circumferenceMm <= MAX_CIRCUMFERENCE_MM;

/** Continuous scale-A aro; round it yourself, the fraction tells you how close the neighbours are. */
export const aroFromCircumference = (circumferenceMm: number): number =>
  circumferenceMm - ARO_OFFSET_MM;

export const circumferenceFromAro = (aro: number): number => aro + ARO_OFFSET_MM;

/** Continuous scale-B aro for a ring of this inner circumference. */
export function aroScaleBFromCircumference(circumferenceMm: number): number {
  const diameter = diameterFromCircumference(circumferenceMm);
  return (diameter - SCALE_B_BASE_DIAMETER_MM) / SCALE_B_STEP_DIAMETER_MM;
}

export const diameterFromAroScaleB = (aro: number): number =>
  SCALE_B_BASE_DIAMETER_MM + aro * SCALE_B_STEP_DIAMETER_MM;

export function usFromCircumference(circumferenceMm: number): number {
  return (diameterFromCircumference(circumferenceMm) - US_BASE_DIAMETER_MM) / US_STEP_DIAMETER_MM;
}

export const circumferenceFromUs = (us: number): number =>
  circumferenceFromDiameter(US_BASE_DIAMETER_MM + us * US_STEP_DIAMETER_MM);

/** Continuous UK index: 0 = A, 1 = B … 25 = Z, 26 = Z+1. */
export const ukIndexFromCircumference = (circumferenceMm: number): number =>
  (circumferenceMm - UK_BASE_CIRCUMFERENCE_MM) / UK_STEP_CIRCUMFERENCE_MM;

export const circumferenceFromUkIndex = (index: number): number =>
  UK_BASE_CIRCUMFERENCE_MM + index * UK_STEP_CIRCUMFERENCE_MM;

const roundTo = (value: number, step: number): number => Math.round(value / step) * step;

/** "7½" style: whole sizes and halves, as US shops sell them. */
export function formatUs(us: number): string {
  const half = roundTo(us, 0.5);
  if (half < 0) return '—';
  const whole = Math.floor(half);
  return half - whole === 0.5 ? `${whole === 0 ? '' : whole}½` : String(whole);
}

/** "N½", "Z+2": UK letters to the nearest half. */
export function formatUk(index: number): string {
  const half = roundTo(index, 0.5);
  if (half < 0) return '—';
  const whole = Math.floor(half);
  const letter = whole <= 25 ? String.fromCharCode(65 + whole) : `Z+${whole - 25}`;
  return half - whole === 0.5 ? `${letter}½` : letter;
}

export interface Neighbours {
  /** Nearest whole aro. */
  aro: number;
  /** Set when the measurement sits close to halfway, so both aros are plausible. */
  between?: [number, number];
}

/**
 * Nearest whole aro, plus the pair either side when the reading is within `band` of the midpoint.
 * A ring measured at 16.5 is honestly "16 or 17", and saying only one of them hides that.
 */
export function nearestAro(continuousAro: number, band = 0.2): Neighbours {
  const aro = Math.round(continuousAro);
  const fraction = continuousAro - Math.floor(continuousAro);
  if (Math.abs(fraction - 0.5) <= band) {
    const low = Math.floor(continuousAro);
    return { aro, between: [low, low + 1] };
  }
  return { aro };
}

export interface SizeResult {
  circumferenceMm: number;
  diameterMm: number;
  /** Continuous scale-A aro, for "between" logic and the store checker. */
  aroExact: number;
  aro: Neighbours;
  /** The same ring on the diameter table some shops use. */
  aroScaleB: number;
  /** ISO 8653 / Europe / France: circumference rounded to the nearest mm. */
  iso: number;
  us: string;
  uk: string;
  /** True when the aro sits outside the 5-35 range shops sell, so the page can say so. */
  outOfRange: boolean;
}

export function sizeFromCircumference(circumferenceMm: number): SizeResult {
  const aroExact = aroFromCircumference(circumferenceMm);
  const diameterMm = diameterFromCircumference(circumferenceMm);
  return {
    circumferenceMm,
    diameterMm,
    aroExact,
    aro: nearestAro(aroExact),
    aroScaleB: Math.round(aroScaleBFromCircumference(circumferenceMm)),
    iso: Math.round(circumferenceMm),
    us: formatUs(usFromCircumference(circumferenceMm)),
    uk: formatUk(ukIndexFromCircumference(circumferenceMm)),
    outOfRange: aroExact < ARO_MIN - 0.5 || aroExact > ARO_MAX + 0.5,
  };
}

export const sizeFromDiameter = (diameterMm: number): SizeResult =>
  sizeFromCircumference(circumferenceFromDiameter(diameterMm));

export type StoreScale = 'A' | 'B' | 'custom';

export interface StoreReference {
  /** An aro from the store's own table. */
  aro: number;
  /** What the store lists for that aro, in mm. */
  mm: number;
  /** Whether the store's number is a diameter or a circumference. */
  kind: 'diameter' | 'circumference';
}

export interface StoreAnswer {
  scale: StoreScale;
  /** The aro to order in that store for the measured ring. */
  aro: number;
  /** Continuous value, so the page can say when it is a close call. */
  aroExact: number;
}

/**
 * Which table a store uses, from one row of it, and what to order there.
 *
 * Both Brazilian tables step about 1 mm of circumference per aro (exactly 1 on scale A, π/3 on
 * scale B), so one row pins the store's table down. A row near scale A or B is snapped to it so
 * that a store's own rounding (16.8 vs 16.83) does not shift the answer; anything else is treated
 * as a house table with scale A's step.
 */
export function storeAro(measuredCircumferenceMm: number, ref: StoreReference): StoreAnswer {
  const refCircumference = ref.kind === 'diameter' ? circumferenceFromDiameter(ref.mm) : ref.mm;
  const refDiameter = diameterFromCircumference(refCircumference);

  if (Math.abs(refCircumference - circumferenceFromAro(ref.aro)) <= 0.8) {
    const aroExact = aroFromCircumference(measuredCircumferenceMm);
    return { scale: 'A', aro: Math.round(aroExact), aroExact };
  }
  if (Math.abs(refDiameter - diameterFromAroScaleB(ref.aro)) <= 0.25) {
    const aroExact = aroScaleBFromCircumference(measuredCircumferenceMm);
    return { scale: 'B', aro: Math.round(aroExact), aroExact };
  }
  const aroExact = ref.aro + (measuredCircumferenceMm - refCircumference);
  return { scale: 'custom', aro: Math.round(aroExact), aroExact };
}

export interface AroRow {
  aro: number;
  circumferenceMm: number;
  diameterMm: number;
  /** Diameter the same aro number has on the scale-B table. */
  diameterScaleBMm: number;
  us: string;
  uk: string;
  iso: number;
}

/** The full table, aro 5 to 35, for the table page and the printable sizer. */
export function aroTable(from = ARO_MIN, to = ARO_MAX): AroRow[] {
  const rows: AroRow[] = [];
  for (let aro = from; aro <= to; aro++) {
    const circumferenceMm = circumferenceFromAro(aro);
    rows.push({
      aro,
      circumferenceMm,
      diameterMm: diameterFromCircumference(circumferenceMm),
      diameterScaleBMm: diameterFromAroScaleB(aro),
      us: formatUs(usFromCircumference(circumferenceMm)),
      uk: formatUk(ukIndexFromCircumference(circumferenceMm)),
      iso: circumferenceMm,
    });
  }
  return rows;
}
