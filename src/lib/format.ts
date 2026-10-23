/** Brazilian number formatting: decimal comma, no thousands separators at these sizes. */

const oneDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const twoDecimals = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "17,8" */
export const formatMm = (mm: number): string => oneDecimal.format(mm);

/** "17,83", for tables where the second decimal tells two aros apart. */
export const formatMm2 = (mm: number): string => twoDecimals.format(mm);

/** "5,6": centimetres, the unit people read off a tape. */
export const formatCm = (mm: number): string => oneDecimal.format(mm / 10);

/**
 * Reads what people type: "17,8", "17.8", " 5,6 cm ". Returns NaN for anything that is not a
 * single number, so callers can show a message instead of guessing.
 */
export function parseDecimal(input: string): number {
  const cleaned = input
    .trim()
    .replace(/\s*(mm|cm)$/i, '')
    .replace(',', '.');
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}
