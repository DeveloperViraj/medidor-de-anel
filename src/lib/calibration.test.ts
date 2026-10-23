import { describe, expect, it } from 'vitest';
import {
  CARD_LONG_MM,
  CARD_SHORT_MM,
  COIN_R1_MM,
  cardLayout,
  isPlausiblePxPerMm,
  onScreenRange,
  parseCalibration,
  pxPerMmFrom,
  sameScreen,
  zoomMoved,
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

  // A 360 px wide phone in "desktop site" mode: a 980 px layout shrunk to fit, zoom 360/980.
  it('judges desktop-site mode by on-screen pixels', () => {
    const zoom = 360 / 980;
    const cssPxPerMm = 5.32 / zoom; // the phone's real 5,32 on-screen px per mm
    expect(cssPxPerMm).toBeGreaterThan(14);
    expect(isPlausiblePxPerMm(cssPxPerMm)).toBe(false);
    expect(isPlausiblePxPerMm(cssPxPerMm, zoom)).toBe(true);
  });
});

describe('cardLayout', () => {
  const phone = onScreenRange(true).max;
  const computer = onScreenRange(false).max;

  it('lays the card flat on a computer, where it fits at every slider value', () => {
    // The tool column on a computer leaves a 686 px stage; 14 px go to the corner and the stub.
    const layout = cardLayout(686 - 14, computer);
    expect(layout).toEqual({ orientation: 'landscape', maxPxPerMm: 7, limitedByScreen: false });
    expect(CARD_LONG_MM * layout.maxPxPerMm).toBeLessThanOrEqual(686 - 14);
  });

  it('reaches the densest common computer screen: a 14" Full HD laptop at 100%', () => {
    expect(computer).toBeGreaterThanOrEqual(157 / 25.4);
    expect(computer).toBeGreaterThanOrEqual(166 / 25.4); // 13.3" Full HD
  });

  it('stands the card up on a phone and caps the slider at the screen', () => {
    // A 360 px phone: the stage runs edge to edge; 14 px go to the corner offset and the line stub.
    const layout = cardLayout(360 - 14, phone);
    expect(layout.orientation).toBe('upright');
    expect(layout.limitedByScreen).toBe(true);
    expect(CARD_SHORT_MM * layout.maxPxPerMm).toBeCloseTo(346, 6);
  });

  // Real scales from the published pixel densities: each phone's true value must be reachable.
  it.each([
    ['720p Android, 360 px', 360, 5.31],
    ['Galaxy S21, 360 px', 360, 5.58],
    ['iPhone 12-16, 390 px', 390, 6.02],
    ['iPhone SE 2/3, 375 px', 375, 6.42],
    ['iPhone 12/13 mini, 375 px', 375, 6.51],
    ['Pixel 8, 412 px', 412, 6.1],
  ])('%s can reach its real scale', (_name, width, real) => {
    expect(cardLayout(width - 14, phone).maxPxPerMm).toBeGreaterThanOrEqual(real);
  });

  it('lays the card flat on a phone held sideways', () => {
    expect(cardLayout(844 - 14, phone).orientation).toBe('landscape');
  });

  it('never lets the outline outgrow the room it is given', () => {
    for (let room = 200; room <= 1900; room += 50) {
      for (const max of [phone, computer, phone / 0.367]) {
        const { orientation, maxPxPerMm } = cardLayout(room, max);
        const widthMm = orientation === 'upright' ? CARD_SHORT_MM : CARD_LONG_MM;
        expect(widthMm * maxPxPerMm).toBeLessThanOrEqual(room + 1e-9);
      }
    }
  });
});

describe('zoomMoved', () => {
  it('ignores rounding and notices pinch-zoom or a mode change', () => {
    expect(zoomMoved(1, 1)).toBe(false);
    expect(zoomMoved(1, 1.015)).toBe(false);
    expect(zoomMoved(1, 1.5)).toBe(true);
    expect(zoomMoved(0.367, 0.367)).toBe(false);
    expect(zoomMoved(0.367, 1)).toBe(true);
    expect(zoomMoved(1, 0.367)).toBe(true);
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
    zoom: 1,
  };

  it('accepts what we store', () => {
    expect(parseCalibration(good)).toEqual(good);
    expect(
      parseCalibration({ ...good, screen: { ...good.screen, viewportRatio: null } }),
    ).not.toBeNull();
  });

  it('reads calibrations saved before the zoom was recorded as zoom 1', () => {
    const { zoom: _zoom, ...old } = good;
    expect(parseCalibration(old)?.zoom).toBe(1);
  });

  it('accepts a desktop-site calibration, judged at its own zoom', () => {
    const desktopSite = { ...good, pxPerMm: 14.5, zoom: 0.367 };
    expect(parseCalibration(desktopSite)).toEqual(desktopSite);
    expect(parseCalibration({ ...desktopSite, zoom: 1 })).toBeNull();
  });

  it('rejects junk', () => {
    expect(parseCalibration(null)).toBeNull();
    expect(parseCalibration('6.1')).toBeNull();
    expect(parseCalibration({ ...good, pxPerMm: 50 })).toBeNull();
    expect(parseCalibration({ ...good, method: 'laser' })).toBeNull();
    expect(parseCalibration({ ...good, screen: { dpr: 'x' } })).toBeNull();
    expect(parseCalibration({ ...good, zoom: 0 })).toBeNull();
    expect(parseCalibration({ ...good, zoom: 'big' })).toBeNull();
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
