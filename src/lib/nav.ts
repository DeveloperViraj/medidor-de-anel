/**
 * Site navigation. Pages join this list when they exist, so the header and footer never link to a
 * 404.
 */
export interface NavItem {
  href: string;
  label: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [{ href: '/', label: 'Medidor' }];

export const FOOTER_NAV: readonly NavItem[] = [{ href: '/', label: 'Medidor de anel online' }];
