import { describe, expect, it } from 'vitest';
import {
  aroFromCircumference,
  aroScaleBFromCircumference,
  aroTable,
  circumferenceFromAro,
  circumferenceFromDiameter,
  circumferenceFromSystem,
  circumferenceFromUkIndex,
  circumferenceFromUs,
  diameterFromAroScaleB,
  diameterFromCircumference,
  formatUk,
  formatUs,
  isPlausibleCircumference,
  nearestAro,
  parseUkSize,
  parseUsSize,
  sizeFromCircumference,
  sizeFromDiameter,
  storeAro,
  usFromCircumference,
} from './sizes';

describe('Brazilian aro, scale A (circumference − 40)', () => {
  // Vivara's size guide: finger circumference in cm "indica o número do seu aro".
  it.each([
    [45, 5],
    [50, 10],
    [56, 16],
    [60, 20],
    [65, 25],
    [70, 30],
  ])('Vivara: %s mm finger is aro %s', (mm, aro) => {
    expect(aroFromCircumference(mm)).toBe(aro);
  });

  // Goldsmith Donício Sena Durães (UFAC 2016): "Um dedo mede 5 centímetros e 6 milímetros logo o
  // número do anel será 16"; Labra: 7,3 cm = aro 33.
  it('matches the goldsmith and Labra examples', () => {
    expect(aroFromCircumference(56)).toBe(16);
    expect(aroFromCircumference(73)).toBe(33);
  });

  // Published inner diameters: JK Alianças aro 16 = 17,83 mm; Gazin aro 25 = 20,69 mm.
  it('gives the diameters jewellers publish', () => {
    expect(diameterFromCircumference(circumferenceFromAro(16))).toBeCloseTo(17.83, 2);
    expect(diameterFromCircumference(circumferenceFromAro(25))).toBeCloseTo(20.69, 2);
    expect(diameterFromCircumference(circumferenceFromAro(10))).toBeCloseTo(15.92, 2);
  });

  it('round-trips mm → aro → mm for every aro', () => {
    for (let aro = 5; aro <= 35; aro++) {
      const diameter = diameterFromCircumference(circumferenceFromAro(aro));
      expect(sizeFromDiameter(diameter).aro.aro).toBe(aro);
    }
  });
});

describe('Brazilian diameter table (scale B)', () => {
  // Extra / Casas Bahia listings: aro 16 = 16,80 mm, aro 19 = 17,80 mm, aro 22 = 18,80 mm.
  it.each([
    [16, 16.8],
    [19, 17.8],
    [22, 18.8],
  ])('aro %s is %s mm across', (aro, mm) => {
    expect(diameterFromAroScaleB(aro)).toBeCloseTo(mm, 2);
  });

  // Isi Laurier: "Aro 13 ≈ 5,0 cm", "Aro 16 ≈ 5,3 cm".
  it('matches Isi Laurier within 0.4 mm of circumference', () => {
    expect(circumferenceFromDiameter(diameterFromAroScaleB(13))).toBeCloseTo(50, 0);
    expect(Math.abs(circumferenceFromDiameter(diameterFromAroScaleB(16)) - 53)).toBeLessThan(0.4);
  });

  it('puts the same ring about three aros higher than scale A', () => {
    const ring = circumferenceFromAro(16); // 17,83 mm across
    expect(Math.round(aroScaleBFromCircumference(ring))).toBe(19);
    // Scale B steps π/3 mm of circumference per aro, a little more than scale A's 1 mm, so the
    // gap narrows from about 3.4 aros at aro 8 to 2.4 at aro 30.
    for (let aro = 8; aro <= 30; aro++) {
      const gap = aroScaleBFromCircumference(circumferenceFromAro(aro)) - aro;
      expect(gap).toBeGreaterThan(2.4);
      expect(gap).toBeLessThan(3.5);
    }
  });
});

describe('US / Canada sizes', () => {
  // Retail charts (Kendra Scott, Olive & Piper, Solvar): US 5/6/7/8 = 15,7/16,5/17,3/18,2 mm.
  it.each([
    [5, 15.7],
    [6, 16.5],
    [7, 17.3],
    [8, 18.2],
  ])('US %s is about %s mm across', (us, mm) => {
    expect(Math.abs(diameterFromCircumference(circumferenceFromUs(us)) - mm)).toBeLessThanOrEqual(
      0.1,
    );
  });

  // NBS Circular 43 (1921): gauge makers used 0.485-0.491 in for size 1, 0.877 in for size 13.
  it('sits inside the 1921 Bureau of Standards gauge range', () => {
    const inches = (us: number) => diameterFromCircumference(circumferenceFromUs(us)) / 25.4;
    expect(inches(1)).toBeGreaterThanOrEqual(0.48);
    expect(inches(1)).toBeLessThanOrEqual(0.491);
    expect(inches(13)).toBeGreaterThanOrEqual(0.87);
    expect(inches(13)).toBeLessThanOrEqual(0.878);
  });

  it('round-trips', () => {
    for (const us of [3, 4.5, 7, 9.5, 13]) {
      expect(usFromCircumference(circumferenceFromUs(us))).toBeCloseTo(us, 9);
    }
  });

  it.each([
    [7, '7'],
    [7.4, '7½'],
    [7.6, '7½'],
    [7.8, '8'],
    [0.5, '½'],
    [-1, '—'],
  ])('formats %s as %s', (us, text) => {
    expect(formatUs(us)).toBe(text);
  });
});

describe('UK / Australia letters', () => {
  // BS 6820: C = 40 mm; third-party chart: K = 50,0, K½ = 50,6, L = 51,2.
  it('follows BS 6820 and published charts', () => {
    expect(circumferenceFromUkIndex(2)).toBe(40);
    expect(circumferenceFromUkIndex(10)).toBe(50);
    expect(Math.abs(circumferenceFromUkIndex(10.5) - 50.6)).toBeLessThan(0.05);
    expect(Math.abs(circumferenceFromUkIndex(11) - 51.2)).toBeLessThanOrEqual(0.05);
  });

  // Wikipedia's US-aligned chart: US 5 = J½, US 7 = N½, US 9 = R½, US 10 = T½.
  it.each([
    [5, 'J½'],
    [7, 'N½'],
    [9, 'R½'],
    [10, 'T½'],
  ])('US %s converts to %s', (us, uk) => {
    expect(sizeFromCircumference(circumferenceFromUs(us)).uk).toBe(uk);
  });

  it('formats letters past Z', () => {
    expect(formatUk(25)).toBe('Z');
    expect(formatUk(27)).toBe('Z+2');
    expect(formatUk(13.5)).toBe('N½');
  });
});

describe('ISO 8653 / Europe', () => {
  it('rounds the circumference to the nearest mm', () => {
    expect(sizeFromDiameter(17.83).iso).toBe(56);
    expect(sizeFromCircumference(54.4).iso).toBe(54);
  });
});

describe('nearestAro', () => {
  it('reports both neighbours near the midpoint', () => {
    expect(nearestAro(16.5)).toEqual({ aro: 17, between: [16, 17] });
    expect(nearestAro(16.35)).toEqual({ aro: 16, between: [16, 17] });
  });

  it('gives a single aro when the reading is clear', () => {
    expect(nearestAro(16.1)).toEqual({ aro: 16 });
    expect(nearestAro(16.9)).toEqual({ aro: 17 });
  });
});

describe('storeAro (which table does the shop use?)', () => {
  const ring = circumferenceFromAro(16); // a scale-A aro 16 ring, 17,83 mm across

  it('recognises a Vivara-style table (scale A)', () => {
    const answer = storeAro(ring, { aro: 16, mm: 56, kind: 'circumference' });
    expect(answer).toMatchObject({ scale: 'A', aro: 16 });
  });

  it('recognises a scale-A table given as diameter', () => {
    expect(storeAro(ring, { aro: 20, mm: 19.1, kind: 'diameter' }).scale).toBe('A');
  });

  it('recognises the marketplace diameter table (scale B) and asks for aro 19', () => {
    const answer = storeAro(ring, { aro: 16, mm: 16.8, kind: 'diameter' });
    expect(answer).toMatchObject({ scale: 'B', aro: 19 });
  });

  it('recognises Isi Laurier (aro 16 = 5,3 cm) as scale B', () => {
    expect(storeAro(ring, { aro: 16, mm: 53, kind: 'circumference' }).scale).toBe('B');
  });

  it('handles a house table with its own offset', () => {
    // A shop whose aro 16 is 54,5 mm around: 1,5 mm smaller than scale A.
    const answer = storeAro(ring, { aro: 16, mm: 54.5, kind: 'circumference' });
    expect(answer.scale).toBe('custom');
    expect(answer.aroExact).toBeCloseTo(17.5, 9);
  });
});

describe('aroTable', () => {
  it('covers aro 5 to 35 with consistent rows', () => {
    const rows = aroTable();
    expect(rows).toHaveLength(31);
    expect(rows[0]).toMatchObject({ aro: 5, circumferenceMm: 45, iso: 45 });
    const aro16 = rows.find((r) => r.aro === 16)!;
    expect(aro16.diameterMm).toBeCloseTo(17.83, 2);
    expect(aro16.diameterScaleBMm).toBeCloseTo(16.8, 2);
    expect(aro16.us).toBe('7½');
  });
});

describe('parseUsSize', () => {
  it.each([
    ['7', 7],
    ['7,5', 7.5],
    ['7.5', 7.5],
    ['7½', 7.5],
    ['7 ½', 7.5],
    ['7 1/2', 7.5],
    ['7 3/4', 7.75],
    ['7 1/4', 7.25],
    ['½', 0.5],
    [' 10 ', 10],
  ])('reads %s', (input, value) => {
    expect(parseUsSize(input)).toBe(value);
  });

  it.each(['', 'sete', '7 5/4', '7/2', '123', '7..5'])('rejects %s', (input) => {
    expect(parseUsSize(input)).toBeNaN();
  });

  it('feeds the US formula: US 7 (54,4 mm around) is aro 14', () => {
    expect(sizeFromCircumference(circumferenceFromUs(parseUsSize('7'))).aro.aro).toBe(14);
  });
});

describe('parseUkSize', () => {
  it.each([
    ['A', 0],
    ['n', 13],
    ['N½', 13.5],
    ['N 1/2', 13.5],
    ['Z', 25],
    ['Z+2', 27],
    ['z2', 27],
  ])('reads %s', (input, value) => {
    expect(parseUkSize(input)).toBe(value);
  });

  it.each(['', 'NN', 'N¼', 'Z+9', '14'])('rejects %s', (input) => {
    expect(parseUkSize(input)).toBeNaN();
  });

  it('round-trips through formatUk', () => {
    for (const letter of ['F', 'K½', 'P', 'T½', 'Z', 'Z+3']) {
      expect(formatUk(parseUkSize(letter))).toBe(letter);
    }
  });
});

describe('circumferenceFromSystem (the converter)', () => {
  it.each([
    ['aro', '16', 56],
    ['eu', '56', 56],
    ['diameter', '17,83', 17.83 * Math.PI],
    ['aroB', '19', 17.8 * Math.PI],
    ['us', '7 1/2', circumferenceFromUs(7.5)],
    ['uk', 'P', circumferenceFromUkIndex(15)],
  ] as const)('%s %s', (system, input, expected) => {
    expect(circumferenceFromSystem(system, input)).toBeCloseTo(expected, 2);
  });

  it('agrees across systems for one ring', () => {
    // A scale-A aro 16 ring read back through every system lands on aro 16.
    const ring = circumferenceFromAro(16);
    const viaEu = circumferenceFromSystem('eu', String(ring));
    const viaDiameter = circumferenceFromSystem('diameter', String(ring / Math.PI));
    expect(sizeFromCircumference(viaEu).aro.aro).toBe(16);
    expect(sizeFromCircumference(viaDiameter).aro.aro).toBe(16);
  });

  it.each([
    ['aro', ''],
    ['aro', 'dezesseis'],
    ['eu', '5,6'], // centimetres typed where millimetres are expected
    ['us', '40'],
    ['uk', '7'],
    ['diameter', '56'], // a circumference typed as a diameter
  ] as const)('rejects %s "%s"', (system, input) => {
    expect(circumferenceFromSystem(system, input)).toBeNaN();
  });
});

describe('isPlausibleCircumference', () => {
  it('accepts fingers and rejects typos', () => {
    expect(isPlausibleCircumference(56)).toBe(true);
    expect(isPlausibleCircumference(5.6)).toBe(false);
    expect(isPlausibleCircumference(560)).toBe(false);
    expect(isPlausibleCircumference(Number.NaN)).toBe(false);
  });
});
