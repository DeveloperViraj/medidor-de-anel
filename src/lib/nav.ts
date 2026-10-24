/**
 * Site navigation. Pages join these lists when they exist, so the header and footer never link
 * to a 404.
 */
export interface NavItem {
  href: string;
  label: string;
}

/** Shown in the header on wide screens, and first in the phone menu. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/tabela-de-medidas-de-anel', label: 'Tabela' },
  { href: '/como-medir-tamanho-de-anel', label: 'Como medir' },
  { href: '/medidor-de-alianca', label: 'Alianças' },
  { href: '/medidor-de-anel-para-imprimir', label: 'Para imprimir' },
];

/** The rest of the guides, in the phone menu and the footer. */
export const GUIDE_NAV: readonly NavItem[] = [
  { href: '/medidor-de-dedo-online', label: 'Medidor de dedo' },
  { href: '/converter-tamanho-de-anel', label: 'Converter tamanho' },
  { href: '/por-que-o-aro-muda-de-loja-para-loja', label: 'Por que o aro muda de loja para loja' },
  { href: '/como-descobrir-tamanho-de-anel-em-segredo', label: 'Descobrir o tamanho em segredo' },
];

export const ABOUT_NAV: readonly NavItem[] = [
  { href: '/sobre', label: 'Sobre' },
  { href: '/privacidade', label: 'Privacidade' },
  { href: '/termos', label: 'Termos de uso' },
  { href: '/contato', label: 'Contato' },
];
