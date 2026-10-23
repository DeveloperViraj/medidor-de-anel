import { describe, expect, it } from 'vitest';
import {
  CARD_LONG_MM,
  CARD_SHORT_MM,
  COIN_R1_MM,
  isPlausiblePxPerMm,
  parseCalibration,
  pxPerMmFrom,
  sameScreen,
  type ScreenFingerprint,
} from './calibration';
import { formatCm, formatMm, parseDecimal } from './format';
import { circumferenceFromDiameter, sizeFromDiameter } from './sizes';

describe('calibration objects', () => {
  it('uses ISO/IEC 7810 ID-1 and the Banco Central R$ 1', () => {
    expect(CARD_LONG_MM).toBe(85.6);
    expect(CARD_SHORT_MM).toBe(53.98);
    expect(COIN_R1_MM).toBe(27);
  });

  it('turns a matched shape into px per mm', () => {
    // A card matched at 330 px across its short edge: 6,113 px/mm (a typical phone).
    expect(pxPerMmFrom(330, CARD_SHORT_MM)).toBeCloseTo(6.1134, 4);
    expect(pxPerMmFrom(165, COIN_R1_MM)).toBeCloseTo(6.1111, 4);
  });

  it('measures a ring through the calibration end to end', () => {
    // Calibrated with the card at 330 px; the person matched the circle at 109 px.
    const pxPerMm = pxPerMmFrom(330, CARD_SHORT_MM);
    const diameterMm = 109 / pxPerMm;
    expect(diameterMm).toBeCloseTo(17.83, 1);
    expect(sizeFromDiameter(diameterMm).aro.aro).toBe(16);
    expect(circumferenceFromDiameter(diameterMm)).toBeCloseTo(56, 0);
  });

  it('refuses values no real screen produces', () => {
    expect(isPlausiblePxPerMm(3.78)).toBe(true);
    expect(isPlausiblePxPerMm(6.4)).toBe(true);
    expect(isPlausiblePxPerMm(1.2)).toBe(false);
    expect(isPlausiblePxPerMm(30)).toBe(false);
  });
});

describe('sameScreen', () => {
  const phone: ScreenFingerprint = { dpr: 3, shortSide: 390, longSide: 844, viewportRatio: 1 };

  it('ignores rotation and scrollbar noise', () => {
    expect(sameScreen(phone, { ...phone })).toBe(true);
    expect(sameScreen(phone, { ...phone, viewportRatio: 0.99 })).toBe(true);
  });

  it('notices browser zoom, Safari page zoom and a different screen', () => {
    expect(sameScreen(phone, { ...phone, dpr: 3.3 })).toBe(false);
    expect(sameScreen(phone, { ...phone, viewportRatio: 0.87 })).toBe(false);
    expect(sameScreen(phone, { ...phone, shortSide: 412, longSide: 915 })).toBe(false);
  });

  it('skips the viewport check on desktops', () => {
    const desktop: ScreenFingerprint = {
      dpr: 1.25,
      shortSide: 864,
      longSide: 1536,
      viewportRatio: null,
    };
    expect(sameScreen(desktop, { ...desktop })).toBe(true);
  });
});

describe('parseCalibration', () => {
  const good = {
    pxPerMm: 6.1,
    method: 'card',
    screen: { dpr: 3, shortSide: 390, longSide: 844, viewportRatio: 1 },
  };

  it('accepts what we store', () => {
    expect(parseCalibration(good)).toEqual(good);
    expect(
      parseCalibration({ ...good, screen: { ...good.screen, viewportRatio: null } }),
    ).not.toBeNull();
  });

  it('rejects junk', () => {
    expect(parseCalibration(null)).toBeNull();
    expect(parseCalibration('6.1')).toBeNull();
    expect(parseCalibration({ ...good, pxPerMm: 50 })).toBeNull();
    expect(parseCalibration({ ...good, method: 'laser' })).toBeNull();
    expect(parseCalibration({ ...good, screen: { dpr: 'x' } })).toBeNull();
  });
});

describe('format', () => {
  it('writes Brazilian decimals', () => {
    expect(formatMm(17.825)).toBe('17,8');
    expect(formatCm(56)).toBe('5,6');
  });

  it('reads what people type', () => {
    expect(parseDecimal('17,8')).toBe(17.8);
    expect(parseDecimal(' 5.6 cm ')).toBe(5.6);
    expect(parseDecimal('56mm')).toBe(56);
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
  });
});
