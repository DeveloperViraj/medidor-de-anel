/**
 * The printable ring sizer: one A4 page, built at deploy time into a static PDF.
 *
 * Everything sits inside 12-198 mm across and 12-268 mm down, so the same file also prints
 * correctly on US Letter (215.9 × 279.4 mm). The page asks PDF viewers not to scale it
 * (PrintScaling: None), and carries a card outline and a 10 cm ruler so the person can check
 * that the printer kept it at 100% before trusting any circle.
 */

import { jsPDF } from 'jspdf';
import { CARD_LONG_MM, CARD_SHORT_MM } from './calibration';
import { formatMm2 } from './format';
import { aroTable, circumferenceFromAro } from './sizes';

const LEFT = 12;
const RIGHT = 198;
const INK: [number, number, number] = [36, 27, 48];
const MUTED: [number, number, number] = [96, 88, 110];
const ACCENT: [number, number, number] = [127, 31, 51];

/** The aros printed as circles. Below 8 and above 30 are rare enough for the table and the strip. */
export const PRINT_ARO_FROM = 8;
export const PRINT_ARO_TO = 30;

export function buildPrintableSizer(siteDomain: string): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({
    title: 'Medidor de anel para imprimir',
    subject: 'Círculos de aro 8 a 30, tira para o dedo e régua de conferência',
    creator: siteDomain,
  });
  // Asks viewers that honour it (Acrobat, many printers) to print at 100%.
  doc.viewerPreferences({ PrintScaling: 'None' });

  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    opts: {
      bold?: boolean;
      color?: [number, number, number];
      align?: 'left' | 'center' | 'right';
    } = {},
  ) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? INK));
    doc.text(value, x, y, { align: opts.align ?? 'left' });
  };
  const paragraph = (value: string, x: number, y: number, width: number, size: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(value, width) as string[];
    doc.text(lines, x, y, { lineHeightFactor: 1.35 });
    return y + lines.length * size * 0.3528 * 1.35;
  };

  // ---- Header -------------------------------------------------------------------------------
  text('Medidor de anel para imprimir', LEFT, 17, 17, { bold: true });
  text(`${siteDomain} · grátis, sem cadastro`, RIGHT, 17, 9, { color: MUTED, align: 'right' });
  doc.setFillColor(255, 244, 214);
  doc.setDrawColor(214, 170, 72);
  doc.setLineWidth(0.3);
  doc.roundedRect(LEFT, 21, RIGHT - LEFT, 9, 1.5, 1.5, 'FD');
  text(
    'Imprima em TAMANHO REAL (100%): desmarque "Ajustar à página". Depois confira com o cartão e a régua.',
    LEFT + 3,
    26.8,
    8.6,
    { bold: true },
  );

  // ---- 1. Check the print -------------------------------------------------------------------
  text('1. Confira a impressão', LEFT, 37, 11, { bold: true, color: ACCENT });
  const cardTop = 40;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.roundedRect(LEFT, cardTop, CARD_LONG_MM, CARD_SHORT_MM, 3, 3, 'S');
  text('Cartão de banco', LEFT + CARD_LONG_MM / 2, cardTop + 24, 10, {
    bold: true,
    align: 'center',
  });
  text('deve cobrir exatamente este contorno', LEFT + CARD_LONG_MM / 2, cardTop + 30, 8, {
    color: MUTED,
    align: 'center',
  });

  // A 10 cm ruler under the card.
  const rulerY = cardTop + CARD_SHORT_MM + 8;
  doc.setLineWidth(0.25);
  doc.line(LEFT, rulerY, LEFT + 100, rulerY);
  for (let mm = 0; mm <= 100; mm++) {
    const length = mm % 10 === 0 ? 4 : mm % 5 === 0 ? 2.6 : 1.5;
    doc.line(LEFT + mm, rulerY, LEFT + mm, rulerY - length);
    if (mm % 10 === 0) text(String(mm / 10), LEFT + mm, rulerY + 3.4, 7, { align: 'center' });
  }
  text('cm', LEFT + 103, rulerY + 3.4, 7, { color: MUTED });

  const noteX = LEFT + CARD_LONG_MM + 8;
  const noteWidth = RIGHT - noteX;
  let y = paragraph(
    'Coloque um cartão de crédito ou débito em cima do contorno: ele deve cobrir a linha por inteiro, sem sobrar nem faltar.',
    noteX,
    cardTop + 3,
    noteWidth,
    9,
  );
  y = paragraph(
    'Meça a régua de baixo com uma régua de verdade: ela deve ter 10 cm.',
    noteX,
    y + 2,
    noteWidth,
    9,
  );
  paragraph(
    'Se algo não bater, a impressora mudou o tamanho da folha. Imprima de novo em 100% antes de usar os círculos.',
    noteX,
    y + 2,
    noteWidth,
    9,
  );

  // ---- 2. Ring circles ----------------------------------------------------------------------
  const circlesTitleY = rulerY + 11;
  text('2. Com um anel que já serve', LEFT, circlesTitleY, 11, { bold: true, color: ACCENT });
  const circlesIntroEnd = paragraph(
    'Apoie o anel sobre os círculos. O tamanho certo é o círculo cuja linha fica exatamente na borda de dentro do anel. Ficou entre dois? Escolha o maior.',
    LEFT,
    circlesTitleY + 5,
    RIGHT - LEFT,
    8.6,
  );

  const rows = aroTable(PRINT_ARO_FROM, PRINT_ARO_TO);
  const perRow = 7;
  const cell = (RIGHT - LEFT) / perRow;
  // 26 mm fits the largest circle (aro 30, 22.3 mm) with its label above the next row.
  const rowHeight = 26;
  const firstRowCentre = circlesIntroEnd + 12;
  doc.setDrawColor(...INK);
  rows.forEach((row, i) => {
    const cx = LEFT + cell * (i % perRow) + cell / 2;
    const cy = firstRowCentre + rowHeight * Math.floor(i / perRow);
    const r = row.diameterMm / 2;
    doc.setLineWidth(0.2);
    doc.circle(cx, cy, r, 'S');
    text(String(row.aro), cx, cy + 1.6, 11, { bold: true, align: 'center' });
    text('aro', cx, cy - 3.2, 6, { color: MUTED, align: 'center' });
    text(`${formatMm2(row.diameterMm)} mm`, cx, cy + r + 3.2, 6.2, {
      color: MUTED,
      align: 'center',
    });
  });
  const circlesBottom = firstRowCentre + rowHeight * (Math.ceil(rows.length / perRow) - 1) + 15;

  // ---- 3. Finger strip ----------------------------------------------------------------------
  const stripTitleY = circlesBottom + 5;
  text('3. Pelo dedo', LEFT, stripTitleY, 11, { bold: true, color: ACCENT });
  const stripIntroEnd = paragraph(
    'Recorte a tira pela linha tracejada. Enrole na base do dedo, com a escala para fora, e leia o aro no ponto onde o começo da tira encontra a escala.',
    LEFT,
    stripTitleY + 5,
    RIGHT - LEFT,
    8.6,
  );
  const stripTop = stripIntroEnd + 1;
  const stripLength = 112;
  const stripHeight = 11;
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.2, 1], 0);
  doc.rect(LEFT, stripTop, stripLength, stripHeight, 'S');
  doc.setLineDashPattern([], 0);
  text('começo', LEFT + 1.5, stripTop + 7, 6.5, { color: MUTED });
  for (let aro = 5; aro <= 35; aro++) {
    const x = LEFT + circumferenceFromAro(aro);
    const major = aro % 5 === 0;
    doc.setLineWidth(major ? 0.3 : 0.18);
    doc.line(x, stripTop, x, stripTop + (major ? 4 : 2.4));
    if (major) text(String(aro), x, stripTop + 8, 7.5, { bold: true, align: 'center' });
  }
  text('aro', LEFT + circumferenceFromAro(35) + 3, stripTop + 8, 6.5, { color: MUTED });
  paragraph(
    'Papel não estica, por isso é melhor que barbante. Meça no fim do dia, com a mão em temperatura normal.',
    LEFT + stripLength + 6,
    stripTop + 3,
    RIGHT - (LEFT + stripLength + 6),
    7.5,
  );

  // ---- Footer -------------------------------------------------------------------------------
  text(
    `Aro = volta do dedo em mm menos 40, a tabela da maioria das joalherias. Algumas lojas usam outra tabela: veja ${siteDomain}/por-que-o-aro-muda-de-loja-para-loja`,
    LEFT,
    267,
    6.6,
    { color: MUTED },
  );

  return doc.output('arraybuffer');
}
