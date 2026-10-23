/**
 * Behaviour for src/components/RingSizer.astro. The maths lives in src/lib (unit-tested); this file
 * only reads inputs, draws the shapes and writes the result.
 */

import {
  CARD_LONG_MM,
  CARD_SHORT_MM,
  COIN_R1_MM,
  isPlausiblePxPerMm,
  parseCalibration,
  sameScreen,
  zoomMoved,
  type Calibration,
  type CalibrationMethod,
  type ScreenFingerprint,
} from '../lib/calibration';
import { formatCm, formatMm, parseDecimal } from '../lib/format';
import {
  circumferenceFromDiameter,
  isPlausibleCircumference,
  sizeFromCircumference,
  storeAro,
  type SizeResult,
} from '../lib/sizes';
import { loadJson, saveJson } from '../lib/storage';

type Method = 'ring' | 'finger' | 'typed';

const CAL_KEY = 'mda:calibration';
const CAL_LABEL: Record<CalibrationMethod, string> = {
  card: 'com um cartão',
  coin: 'com uma moeda de R$ 1',
  ruler: 'com uma régua',
};
/** Each −/+ press on the calibration changes the card's height by about one pixel. */
const CAL_STEP = 0.02;
const RING_STEP_MM = 0.1;
const RING_MIN_MM = 12;
const RING_MAX_MM = 25;

function currentScreen(): ScreenFingerprint {
  const shortSide = Math.min(screen.width, screen.height);
  const longSide = Math.max(screen.width, screen.height);
  // Only phones and tablets in portrait: there the viewport fills the screen unless Safari's page
  // zoom is on. Landscape adds safe-area insets, and desktops resize windows freely.
  const coarse = matchMedia('(pointer: coarse)').matches;
  const portrait = innerHeight >= innerWidth;
  const viewportRatio =
    coarse && portrait
      ? Math.round((document.documentElement.clientWidth / shortSide) * 1000) / 1000
      : null;
  return { dpr: devicePixelRatio, shortSide, longSide, viewportRatio };
}

/**
 * How many on-screen px one CSS px takes: 1 normally, 2 when pinched in twice, about 0.37 when a
 * phone browser shows the "desktop site". On phones in portrait it is measured directly (screen
 * width over the visible width in CSS px), because some browsers report visualViewport.scale = 1
 * for a desktop-site page shrunk to fit. Elsewhere the reported scale is used.
 */
function pageZoom(): number {
  const viewport = window.visualViewport;
  const portrait = innerHeight >= innerWidth;
  if (matchMedia('(pointer: coarse)').matches && portrait) {
    const visibleWidth = viewport?.width ?? document.documentElement.clientWidth;
    const zoom = Math.min(screen.width, screen.height) / visibleWidth;
    if (Number.isFinite(zoom) && zoom > 0) return Math.round(zoom * 1000) / 1000;
  }
  const scale = viewport?.scale;
  return scale && scale > 0 ? scale : 1;
}

/**
 * iPhones can be recognised from their screen size and pixel ratio, and Apple's published pixel
 * densities give the real scale. Every 3x model except the minis is 0.166 mm per CSS px (458-460
 * ppi), every 2x model 0.156 (326 ppi); 320 px at 3x is Display Zoom on a 12/13 (0.202). The
 * 375x812 3x screen is shared by the X/XS/11 Pro, the 12/13 mini and a zoomed Pro Max, so this is
 * only where the card outline starts: the person always checks it against a real card.
 * Sources: Apple tech specs as compiled at ios-resolution.com (October 2026).
 */
function iphonePxPerMm(): number | null {
  if (!/iPhone/.test(navigator.userAgent)) return null;
  const dpr = Math.round(devicePixelRatio);
  if (dpr === 3) return Math.min(screen.width, screen.height) === 320 ? 1 / 0.202 : 1 / 0.1664;
  if (dpr === 2) return 1 / 0.1558;
  return null;
}

/**
 * A first guess in on-screen px, so the shape starts near the right size. Android hides the phone
 * model from JavaScript, so it gets the width rule: phones are 64-72 mm wide for 360-430 px (about
 * 5.4-6.3 px/mm). Desktops sit near the CSS reference of 96 px per inch.
 */
function guessOnScreenPxPerMm(): number {
  const iphone = iphonePxPerMm();
  if (iphone) return iphone;
  if (matchMedia('(pointer: coarse)').matches) {
    const estimate = Math.min(screen.width, screen.height) / 66;
    return Math.min(8, Math.max(4.5, estimate));
  }
  return 96 / 25.4;
}

/**
 * Phones in portrait take the card standing upright: its 54 mm short side fits across any
 * current phone screen, so the whole outline shows. Elsewhere it lies flat, as on a monitor.
 */
const cardOrientation = (): 'upright' | 'landscape' =>
  matchMedia('(pointer: coarse)').matches && innerHeight >= innerWidth ? 'upright' : 'landscape';

/** Where the card's top-left corner sits in the stage, in CSS px. Fixed while the size changes. */
const CARD_CORNER = { left: 14, top: 18 };

/**
 * Horizontal drags on a stage resize its shape, so the edge follows the finger. Vertical drags
 * still scroll the page (the stage is touch-action: pan-y), which then cancels the drag.
 */
function dragToResize(stage: HTMLElement, onDrag: (dx: number, start: boolean) => void): void {
  let startX: number | null = null;
  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    startX = event.clientX;
    onDrag(0, true);
    try {
      // Keeps the drag going when the finger slides off the stage; optional, so failures are fine.
      stage.setPointerCapture(event.pointerId);
    } catch {
      /* no active pointer (synthetic events, some embedded browsers) */
    }
  });
  stage.addEventListener('pointermove', (event) => {
    if (startX !== null) onDrag(event.clientX - startX, false);
  });
  const end = () => {
    startX = null;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

/** Repeats while a −/+ button is held; one step per tap or key press. */
function holdToRepeat(button: HTMLButtonElement, step: () => void): void {
  let delay: number | undefined;
  let repeat: number | undefined;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(repeat);
  };
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    step();
    delay = window.setTimeout(() => {
      repeat = window.setInterval(step, 70);
    }, 400);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel'] as const) {
    button.addEventListener(type, stop);
  }
  // Keyboard activation arrives as a click with no pointer (detail 0); pointer clicks are handled
  // above, so they are ignored here to avoid a double step.
  button.addEventListener('click', (event) => {
    if (event.detail === 0) step();
  });
}

export function initRingSizer(root: HTMLElement): void {
  const one = <T extends Element>(selector: string): T => {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`Ring sizer markup is missing ${selector}`);
    return el;
  };
  const all = <T extends Element>(selector: string): T[] => [...root.querySelectorAll<T>(selector)];

  const panels = {
    calibrate: one<HTMLElement>('[data-panel="calibrate"]'),
    ring: one<HTMLElement>('[data-panel="ring"]'),
    finger: one<HTMLElement>('[data-panel="finger"]'),
    typed: one<HTMLElement>('[data-panel="typed"]'),
  };
  const calStage = one<HTMLElement>('[data-cal-stage]');
  const calRange = one<HTMLInputElement>('[data-cal-range]');
  const calCard = one<HTMLElement>('[data-cal-shape="card"]');
  const calCoin = one<HTMLElement>('[data-cal-shape="coin"]');
  const calRulerWrap = one<HTMLElement>('[data-cal-shape="ruler"]');
  const calRuler = one<SVGSVGElement>('[data-cal-ruler]');
  const ringCircle = one<HTMLElement>('[data-ring-circle]');
  const ringRange = one<HTMLInputElement>('[data-ring-range]');
  const ringLive = one<HTMLElement>('[data-ring-live]');
  const fingerInput = one<HTMLInputElement>('[data-finger-input]');
  const fingerMsg = one<HTMLElement>('[data-finger-msg]');
  const typedInput = one<HTMLInputElement>('[data-typed-input]');
  const typedMsg = one<HTMLElement>('[data-typed-msg]');
  const result = one<HTMLElement>('[data-result]');
  const storeAroInput = one<HTMLInputElement>('[data-store-aro]');
  const storeMmInput = one<HTMLInputElement>('[data-store-mm]');
  const storeKind = one<HTMLSelectElement>('[data-store-kind]');
  const storeAnswer = one<HTMLElement>('[data-store-answer]');
  const copyLabel = one<HTMLElement>('[data-copy-label]');

  // The zoom the page rests at. Slider limits and steps are in CSS px, so they follow it: in
  // desktop-site mode one on-screen millimetre takes almost three times the CSS px.
  const baseZoom = pageZoom();
  calRange.min = String(2.5 / baseZoom);
  calRange.max = String(12 / baseZoom);
  const calStep = CAL_STEP / baseZoom;
  const desktopSite = matchMedia('(pointer: coarse)').matches && baseZoom < 0.9;
  one<HTMLElement>('[data-desktop-note]').hidden = !desktopSite;

  const stored = parseCalibration(loadJson(CAL_KEY));
  let calibration: Calibration | null = stored;
  let calibrationStale =
    stored !== null &&
    (!sameScreen(stored.screen, currentScreen()) || zoomMoved(stored.zoom, baseZoom));
  let calMethod: CalibrationMethod = stored?.method ?? 'card';
  let pxPerMm = stored && !calibrationStale ? stored.pxPerMm : guessOnScreenPxPerMm() / baseZoom;
  let method: Method = 'ring';
  let ringDiameter = Number(ringRange.value);
  let ringTouched = false;
  /** The circumference behind the result on screen, or null when there is none. */
  let current: number | null = null;

  const checked = (name: string) =>
    root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;

  // ---- Calibration ------------------------------------------------------------------------

  function drawCalibration(): void {
    calRange.value = String(pxPerMm);
    calRange.setAttribute('aria-valuetext', `${formatMm(pxPerMm * 10)} pixels por centímetro`);
    calCard.hidden = calMethod !== 'card';
    calCoin.hidden = calMethod !== 'coin';
    calRulerWrap.hidden = calMethod !== 'ruler';
    const hintKey = calMethod === 'card' ? `card-${cardOrientation()}` : calMethod;
    for (const hint of all<HTMLElement>('[data-cal-hint]')) {
      hint.hidden = hint.dataset.calHint !== hintKey;
    }

    if (calMethod === 'card') {
      const { width, height } = cardSizePx();
      calCard.style.left = `${CARD_CORNER.left}px`;
      calCard.style.top = `${CARD_CORNER.top}px`;
      calCard.style.width = `${width}px`;
      calCard.style.height = `${height}px`;
      // Real cards have corners of about 3 mm radius; drawn the same so the outline looks right.
      one<HTMLElement>('.cal-card-body').style.borderRadius = `${3 * pxPerMm}px`;
    } else if (calMethod === 'coin') {
      const size = `${COIN_R1_MM * pxPerMm}px`;
      calCoin.style.width = size;
      calCoin.style.height = size;
    } else {
      drawRuler();
    }
    // The card needs its full height below the corner plus room for the line stubs.
    calStage.style.minHeight =
      calMethod === 'card' ? `${Math.max(240, CARD_CORNER.top + cardSizePx().height + 44)}px` : '';
  }

  /** The card outline in CSS px at the current calibration value, in the orientation in use. */
  function cardSizePx(): { width: number; height: number; widthMm: number } {
    const upright = cardOrientation() === 'upright';
    const widthMm = upright ? CARD_SHORT_MM : CARD_LONG_MM;
    const heightMm = upright ? CARD_LONG_MM : CARD_SHORT_MM;
    return { width: widthMm * pxPerMm, height: heightMm * pxPerMm, widthMm };
  }

  function drawRuler(): void {
    const width = Math.max(0, calStage.clientWidth - 24);
    const mm = Math.floor(width / pxPerMm);
    const height = 44;
    let ticks = '';
    for (let i = 0; i <= mm; i++) {
      const x = (i * pxPerMm).toFixed(2);
      const length = i % 10 === 0 ? 24 : i % 5 === 0 ? 16 : 9;
      ticks += `<line x1="${x}" x2="${x}" y1="0" y2="${length}" stroke="currentColor" stroke-width="1"/>`;
      if (i % 10 === 0) {
        ticks += `<text x="${x}" y="40" font-size="12" text-anchor="middle" fill="currentColor">${i / 10}</text>`;
      }
    }
    calRuler.setAttribute('width', String(width));
    calRuler.setAttribute('height', String(height));
    calRuler.setAttribute('viewBox', `0 0 ${width} ${height}`);
    calRuler.innerHTML = ticks;
  }

  function setPxPerMm(value: number): void {
    pxPerMm = Math.min(Number(calRange.max), Math.max(Number(calRange.min), value));
    drawCalibration();
  }

  calRange.addEventListener('input', () => setPxPerMm(Number(calRange.value)));

  // Dragging moves the card's right edge with the finger. Round shapes grow by the finger's
  // movement in diameter, so the rim moves at half speed: finer control where a pixel counts.
  // The ruler has no single edge to drag.
  let dragStartPx = pxPerMm;
  dragToResize(calStage, (dx, start) => {
    if (start) {
      dragStartPx = pxPerMm;
      return;
    }
    if (calMethod === 'card') {
      const { widthMm } = cardSizePx();
      setPxPerMm((widthMm * dragStartPx + dx) / widthMm);
    } else if (calMethod === 'coin') {
      setPxPerMm((COIN_R1_MM * dragStartPx + dx) / COIN_R1_MM);
    }
  });
  for (const button of all<HTMLButtonElement>('[data-cal-step]')) {
    holdToRepeat(button, () => setPxPerMm(pxPerMm + Number(button.dataset.calStep) * calStep));
  }
  for (const input of all<HTMLInputElement>('input[name="cal-method"]')) {
    input.addEventListener('change', () => {
      calMethod = input.value as CalibrationMethod;
      drawCalibration();
    });
  }

  one<HTMLButtonElement>('[data-cal-done]').addEventListener('click', () => {
    const zoom = pageZoom();
    const calMsg = one<HTMLElement>('[data-cal-msg]');
    if (!isPlausiblePxPerMm(pxPerMm, zoom)) {
      calMsg.textContent =
        'Esse tamanho não parece o de um cartão de verdade. Encoste o cartão na tela e ajuste de novo.';
      return;
    }
    calMsg.textContent = '';
    calibration = { pxPerMm, method: calMethod, screen: currentScreen(), zoom };
    calibrationStale = false;
    saveJson(CAL_KEY, calibration);
    showPanels();
    checkZoom();
    panels.ring.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  one<HTMLButtonElement>('[data-recalibrate]').addEventListener('click', () => {
    calibration = null;
    showPanels();
  });

  // ---- Ring on screen ---------------------------------------------------------------------

  function drawRing(): void {
    if (!calibration) return;
    const size = `${ringDiameter * calibration.pxPerMm}px`;
    ringCircle.style.width = size;
    ringCircle.style.height = size;
    ringRange.value = String(ringDiameter);
    const size16 = sizeFromCircumference(circumferenceFromDiameter(ringDiameter));
    const text = `${formatMm(ringDiameter)} mm · aro ${size16.aro.aro}`;
    ringLive.textContent = text;
    ringRange.setAttribute(
      'aria-valuetext',
      `${formatMm(ringDiameter)} milímetros, aro ${size16.aro.aro}`,
    );

    const bar = one<HTMLElement>('[data-check-bar]');
    const barMm = calStage.clientWidth / calibration.pxPerMm >= 60 ? 50 : 30;
    bar.style.width = `${barMm * calibration.pxPerMm}px`;
    one<HTMLElement>('[data-check-label]').textContent = `${barMm / 10} cm`;
    one<HTMLElement>('[data-cal-summary]').textContent =
      `Tela calibrada ${CAL_LABEL[calibration.method]}.`;
  }

  function setRing(diameter: number): void {
    ringDiameter = Math.min(RING_MAX_MM, Math.max(RING_MIN_MM, Math.round(diameter * 100) / 100));
    ringTouched = true;
    drawRing();
    update();
  }

  ringRange.addEventListener('input', () => setRing(Number(ringRange.value)));

  // A ring is matched to a tenth of a millimetre, so the drag is gentle: the diameter grows by the
  // finger's movement and the rim follows at half speed.
  let dragStartDiameter = ringDiameter;
  dragToResize(one<HTMLElement>('[data-ring-stage]'), (dx, start) => {
    if (!calibration) return;
    if (start) {
      dragStartDiameter = ringDiameter;
      return;
    }
    setRing(dragStartDiameter + dx / calibration.pxPerMm);
  });
  for (const button of all<HTMLButtonElement>('[data-ring-step]')) {
    holdToRepeat(button, () =>
      setRing(ringDiameter + Number(button.dataset.ringStep) * RING_STEP_MM),
    );
  }

  // ---- Typed measurements -----------------------------------------------------------------

  /** The finger strip in mm, or a message explaining what is wrong with the input. */
  function fingerCircumference(): number | string | null {
    const raw = fingerInput.value;
    if (!raw.trim()) return null;
    const value = parseDecimal(raw);
    if (Number.isNaN(value)) return 'Digite só o número, por exemplo 5,6.';
    const unit = checked('finger-unit');
    const mm = unit === 'cm' ? value * 10 : value;
    if (isPlausibleCircumference(mm)) return mm;
    if (unit === 'mm' && isPlausibleCircumference(value * 10)) {
      return 'Parece que a medida está em centímetros. Troque a unidade para cm.';
    }
    if (unit === 'cm' && isPlausibleCircumference(value)) {
      return 'Parece que a medida está em milímetros. Troque a unidade para mm.';
    }
    return 'Essa medida não parece a volta de um dedo (normalmente entre 4 e 8 cm).';
  }

  function typedCircumference(): number | string | null {
    const raw = typedInput.value;
    if (!raw.trim()) return null;
    const value = parseDecimal(raw);
    if (Number.isNaN(value)) return 'Digite só o número, por exemplo 17,8.';
    const kind = checked('typed-kind');
    const mm = kind === 'diameter' ? circumferenceFromDiameter(value) : value;
    if (isPlausibleCircumference(mm)) return mm;
    if (kind === 'diameter' && isPlausibleCircumference(value)) {
      return 'Esse número parece a circunferência, não o diâmetro. Escolha "Circunferência".';
    }
    if (kind === 'circumference' && isPlausibleCircumference(circumferenceFromDiameter(value))) {
      return 'Esse número parece o diâmetro do anel. Escolha "Diâmetro".';
    }
    return 'Essa medida não parece de um anel. Confira se está em milímetros.';
  }

  fingerInput.addEventListener('input', update);
  typedInput.addEventListener('input', update);
  for (const input of all<HTMLInputElement>(
    'input[name="finger-unit"], input[name="typed-kind"]',
  )) {
    input.addEventListener('change', update);
  }

  // ---- Result -----------------------------------------------------------------------------

  function measurement(): number | null {
    if (method === 'ring') {
      return calibration && ringTouched ? circumferenceFromDiameter(ringDiameter) : null;
    }
    const value = method === 'finger' ? fingerCircumference() : typedCircumference();
    const msg = method === 'finger' ? fingerMsg : typedMsg;
    msg.textContent = typeof value === 'string' ? value : '';
    return typeof value === 'number' ? value : null;
  }

  function update(): void {
    current = measurement();
    result.hidden = current === null;
    if (current === null) return;
    renderResult(sizeFromCircumference(current));
    renderStoreAnswer();
  }

  function setText(selector: string, text: string): void {
    one<HTMLElement>(selector).textContent = text;
  }

  function renderResult(size: SizeResult): void {
    setText('[data-r-aro]', String(size.aro.aro));
    const between = one<HTMLElement>('[data-r-between]');
    between.hidden = !size.aro.between;
    if (size.aro.between) {
      const [low, high] = size.aro.between;
      between.textContent = `Ficou entre o ${low} e o ${high}. Na dúvida, escolha o ${high}, principalmente em alianças.`;
    }
    const out = one<HTMLElement>('[data-r-out]');
    out.hidden = !size.outOfRange;
    out.textContent = size.outOfRange
      ? 'Esse tamanho fica fora da numeração comum (aro 5 a 35). Muitas lojas fazem sob encomenda.'
      : '';
    setText('[data-r-diameter]', `${formatMm(size.diameterMm)} mm`);
    setText('[data-r-circumference]', `${formatMm(size.circumferenceMm)} mm`);
    setText('[data-r-circumference-cm]', `${formatCm(size.circumferenceMm)} cm`);
    setText('[data-r-us]', size.us);
    setText('[data-r-iso]', String(size.iso));
    setText('[data-r-uk]', `≈ ${size.uk}`);
    setText('[data-r-it]', String(size.aro.aro));
    setText('[data-r-scale-b]', `aro ${size.aroScaleB}`);
  }

  function renderStoreAnswer(): void {
    storeAnswer.textContent = '';
    if (current === null) return;
    const aro = Number(storeAroInput.value.trim());
    const value = parseDecimal(storeMmInput.value);
    if (!storeAroInput.value.trim() || !storeMmInput.value.trim()) return;
    if (!Number.isInteger(aro) || aro < 1 || aro > 40) {
      storeAnswer.textContent = 'Digite o número do aro da loja, por exemplo 16.';
      return;
    }
    const choice = storeKind.value;
    const mm = choice === 'circumference-cm' ? value * 10 : value;
    const kind = choice === 'diameter' ? 'diameter' : 'circumference';
    const plausible = kind === 'diameter' ? mm >= 10 && mm <= 30 : mm >= 30 && mm <= 95;
    if (Number.isNaN(value) || !plausible) {
      storeAnswer.textContent = 'Essa medida não combina com o tipo escolhido. Confira a unidade.';
      return;
    }
    const answer = storeAro(current, { aro, mm, kind });
    const low = Math.floor(answer.aroExact);
    const close = Math.abs(answer.aroExact - low - 0.5) <= 0.2;
    const lead =
      answer.scale === 'A'
        ? 'Essa loja usa a tabela padrão (volta menos 40).'
        : answer.scale === 'B'
          ? 'Essa loja usa a tabela por diâmetro.'
          : 'Essa loja usa uma tabela própria.';
    const ask = close
      ? `Nela, você fica entre o ${low} e o ${low + 1}: na dúvida, peça o aro ${low + 1}.`
      : `Nela, peça o aro ${answer.aro}.`;
    storeAnswer.textContent = `${lead} ${ask}`;
  }

  for (const el of [storeAroInput, storeMmInput, storeKind]) {
    el.addEventListener('input', renderStoreAnswer);
  }

  one<HTMLButtonElement>('[data-copy-link]').addEventListener('click', async () => {
    if (current === null) return;
    const url = new URL(location.href);
    url.search = `?c=${current.toFixed(1)}`;
    url.hash = 'medidor';
    const original = copyLabel.textContent;
    try {
      await navigator.clipboard.writeText(url.toString());
      copyLabel.textContent = 'Link copiado';
    } catch {
      copyLabel.textContent = 'Não deu para copiar';
    }
    window.setTimeout(() => (copyLabel.textContent = original), 2500);
  });

  one<HTMLButtonElement>('[data-restart]').addEventListener('click', () => {
    ringTouched = false;
    fingerInput.value = '';
    typedInput.value = '';
    storeAroInput.value = '';
    storeMmInput.value = '';
    update();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---- Panels, zoom and screen changes ----------------------------------------------------

  function showPanels(): void {
    const needsCalibration = method === 'ring' && (!calibration || calibrationStale);
    panels.calibrate.hidden = !needsCalibration;
    panels.ring.hidden = method !== 'ring' || needsCalibration;
    panels.finger.hidden = method !== 'finger';
    panels.typed.hidden = method !== 'typed';
    one<HTMLElement>('[data-stale-note]').hidden = !(needsCalibration && calibrationStale);
    if (needsCalibration) drawCalibration();
    else drawRing();
    update();
  }

  for (const input of all<HTMLInputElement>('input[name="method"]')) {
    input.addEventListener('change', () => {
      method = input.value as Method;
      showPanels();
    });
  }

  /**
   * Pinch-zoom changes the size of everything on screen, so the shapes stop being true to size.
   * Measured against the calibration's own zoom, or the resting zoom while calibrating.
   */
  function checkZoom(): void {
    const reference = calibration && !calibrationStale ? calibration.zoom : baseZoom;
    const zoomed = zoomMoved(reference, pageZoom());
    for (const note of all<HTMLElement>('[data-zoom-note]')) note.hidden = !zoomed;
  }
  window.visualViewport?.addEventListener('resize', checkZoom);

  /** Browser zoom or a move to another monitor invalidates the calibration. */
  function checkScreen(): void {
    if (calibration && !calibrationStale && !sameScreen(calibration.screen, currentScreen())) {
      calibrationStale = true;
      showPanels();
    } else if (!panels.calibrate.hidden && calMethod === 'ruler') {
      drawRuler();
    }
  }
  window.addEventListener('resize', checkScreen);

  // A shared link (?c=56.0) opens straight on its result.
  const shared = Number(new URL(location.href).searchParams.get('c'));
  if (isPlausibleCircumference(shared)) {
    method = 'typed';
    root.querySelector<HTMLInputElement>('input[name="method"][value="typed"]')!.checked = true;
    root.querySelector<HTMLInputElement>(
      'input[name="typed-kind"][value="circumference"]',
    )!.checked = true;
    typedInput.value = formatMm(shared);
  }
  const calInput = root.querySelector<HTMLInputElement>(
    `input[name="cal-method"][value="${calMethod}"]`,
  );
  if (calInput) calInput.checked = true;

  showPanels();
  checkZoom();
}
