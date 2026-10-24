/**
 * Behaviour for src/components/CouplePanel.astro: one saved size per person, the partner invite
 * link and the combined link. Sizes travel as inner circumferences in mm with one decimal
 * (?a=56.0&b=62.0); nothing personal is ever put in a link.
 */

import { formatMm } from '../lib/format';
import { isPlausibleCircumference, sizeFromCircumference } from '../lib/sizes';
import { loadJson, saveJson } from '../lib/storage';

type Slot = 'a' | 'b';

const KEY = 'mda:couple';
const SLOTS: Slot[] = ['a', 'b'];

const valid = (value: unknown): number | null =>
  typeof value === 'number' && isPlausibleCircumference(value) ? value : null;

/** "aro 16 (17,8 mm por dentro)" */
function describe(circumference: number): string {
  const size = sizeFromCircumference(circumference);
  return `aro ${size.aro.aro} (${formatMm(size.diameterMm)} mm por dentro)`;
}

export function initCouple(panel: HTMLElement, sizer: HTMLElement): void {
  const one = <T extends Element>(selector: string): T => {
    const el = panel.querySelector<T>(selector);
    if (!el) throw new Error(`Couple panel markup is missing ${selector}`);
    return el;
  };

  const sizes: Record<Slot, number | null> = { a: null, b: null };
  let current: number | null = null;

  // A shared link wins over what this device remembers: it is what the person was sent.
  const params = new URL(location.href).searchParams;
  const fromLink = { a: valid(Number(params.get('a'))), b: valid(Number(params.get('b'))) };
  if (fromLink.a !== null || fromLink.b !== null) {
    sizes.a = fromLink.a;
    sizes.b = fromLink.b;
  } else {
    const stored = loadJson(KEY) as Record<string, unknown> | null;
    sizes.a = valid(stored?.a);
    sizes.b = valid(stored?.b);
  }

  // Someone who opened a partner's invite is the partner: their job is to measure, not to invite.
  const receivedInvite = fromLink.a !== null && fromLink.b === null;
  const note = one<HTMLElement>('[data-from-link]');
  const partnerSize = fromLink.a;
  if (receivedInvite && partnerSize !== null) {
    note.hidden = false;
    note.textContent = `Seu par mandou a medida: ${describe(partnerSize)}. Agora meça a sua e guarde como Pessoa 2.`;
  } else if (fromLink.a !== null && fromLink.b !== null) {
    note.hidden = false;
    note.textContent = 'Estas são as medidas do link que você recebeu.';
  }

  const linkFor = (a: number | null, b: number | null): string => {
    const url = new URL(location.pathname, location.origin);
    if (a !== null) url.searchParams.set('a', a.toFixed(1));
    if (b !== null) url.searchParams.set('b', b.toFixed(1));
    return url.toString();
  };
  const whatsapp = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

  // Once someone saves or clears a size, this device holds the truth. Drop the link's query so a
  // reload doesn't bring back the sizes from the link, and hide the note about it.
  function persist(): void {
    saveJson(KEY, { a: sizes.a, b: sizes.b });
    if (location.search) history.replaceState(history.state, '', location.pathname + location.hash);
    note.hidden = true;
  }

  function render(): void {
    for (const slot of SLOTS) {
      const box = one<HTMLElement>(`[data-slot="${slot}"]`);
      const value = sizes[slot];
      const aro = box.querySelector<HTMLElement>('[data-slot-aro]')!;
      const mm = box.querySelector<HTMLElement>('[data-slot-mm]')!;
      const scaleB = box.querySelector<HTMLElement>('[data-slot-b]')!;
      const save = box.querySelector<HTMLButtonElement>('[data-save]')!;
      const clear = box.querySelector<HTMLButtonElement>('[data-clear]')!;
      if (value === null) {
        aro.textContent = '—';
        mm.textContent = 'Ainda sem medida';
        scaleB.hidden = true;
      } else {
        const size = sizeFromCircumference(value);
        aro.textContent = `Aro ${size.aro.aro}`;
        mm.textContent = `${formatMm(size.diameterMm)} mm de diâmetro · ${formatMm(value)} mm de volta`;
        scaleB.hidden = false;
        scaleB.textContent = `Em lojas com tabela por diâmetro: aro ${size.aroScaleB}`;
      }
      save.disabled = current === null;
      save.querySelector<HTMLElement>('[data-save-label]')!.textContent =
        value === null ? 'Guardar a medida atual' : 'Trocar pela medida atual';
      clear.hidden = value === null;
    }

    const both = sizes.a !== null && sizes.b !== null;
    const onlyOne = !both && (sizes.a !== null || sizes.b !== null);
    one<HTMLElement>('[data-both]').hidden = !both;
    one<HTMLElement>('[data-invite]').hidden = !onlyOne || (receivedInvite && sizes.b === null);

    if (both) {
      const link = linkFor(sizes.a, sizes.b);
      one<HTMLElement>('[data-both-summary]').textContent =
        `Pessoa 1: ${describe(sizes.a!)}. Pessoa 2: ${describe(sizes.b!)}.`;
      one<HTMLAnchorElement>('[data-both-whatsapp]').href = whatsapp(
        `Medidas das nossas alianças: ${describe(sizes.a!)} e ${describe(sizes.b!)}. ${link}`,
      );
      one<HTMLElement>('[data-both-copy]').dataset.link = link;
    } else if (onlyOne) {
      // The saved size always travels as Pessoa 1, so the partner saves theirs as Pessoa 2.
      const saved = (sizes.a ?? sizes.b)!;
      const link = linkFor(saved, null);
      one<HTMLAnchorElement>('[data-invite-whatsapp]').href = whatsapp(
        `Estou vendo o tamanho das nossas alianças. O meu deu ${describe(saved)}. Mede o seu aqui, leva um minuto: ${link}`,
      );
      one<HTMLElement>('[data-invite-copy]').dataset.link = link;
    }
  }

  sizer.addEventListener('sizer:result', (event) => {
    current = (event as CustomEvent<number | null>).detail;
    render();
  });

  for (const slot of SLOTS) {
    one<HTMLButtonElement>(`[data-save="${slot}"]`).addEventListener('click', () => {
      if (current === null) return;
      sizes[slot] = current;
      persist();
      render();
      // With one person saved, start the sizer fresh for the other.
      const other = slot === 'a' ? 'b' : 'a';
      if (sizes[other] === null) {
        one<HTMLElement>('[data-couple-hint]').textContent =
          `${slot === 'a' ? 'Pessoa 1' : 'Pessoa 2'} guardada. Agora meça a outra pessoa no medidor acima.`;
        sizer.dispatchEvent(new CustomEvent('sizer:reset'));
      }
    });
    one<HTMLButtonElement>(`[data-clear="${slot}"]`).addEventListener('click', () => {
      sizes[slot] = null;
      persist();
      render();
    });
  }

  for (const selector of ['[data-invite-copy]', '[data-both-copy]']) {
    const button = one<HTMLButtonElement>(selector);
    const label = button.querySelector<HTMLElement>('[data-copy-text]')!;
    button.addEventListener('click', async () => {
      const link = button.dataset.link;
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link);
        label.textContent = 'Link copiado';
      } catch {
        label.textContent = 'Não deu para copiar';
      }
      window.setTimeout(() => (label.textContent = 'Copiar o link'), 2500);
    });
  }

  render();
}
