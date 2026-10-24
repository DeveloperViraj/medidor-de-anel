import { describe, expect, it } from 'vitest';
import { buildPrintableSizer } from './printable';

describe('printable sizer', () => {
  const pdf = new TextDecoder('latin1').decode(buildPrintableSizer('medidordeanel.com'));

  it('is a one-page A4 PDF', () => {
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(1);
    // A4 in points: 595.28 × 841.89.
    expect(pdf).toMatch(/\/MediaBox \[0 0 595\.2\d+ 841\.8\d+\]/);
  });

  it('asks viewers to print at 100%', () => {
    expect(pdf).toContain('/PrintScaling /None');
  });

  it('names the site and carries the check instructions', () => {
    expect(pdf).toContain('medidordeanel.com');
    expect(pdf).toContain('TAMANHO REAL');
  });
});
