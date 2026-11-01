/**
 * Partner shops paid through the Awin affiliate network. The publisher ID is not a secret: it is in
 * every tracking link. Shop facts quoted on the site were read on the shop's own pages on the date
 * given, so recheck them before changing the copy.
 */

export const AWIN_PUBLISHER_ID = 3138998;

export interface Partner {
  name: string;
  /** The advertiser's Awin ID (awinmid). */
  awinMerchantId: number;
}

export const PARTNERS = {
  /** Checked 1 Nov 2026: pairs with a separate aro per person (11 to 35), first exchange free within 7 days. */
  aliancasImperiais: { name: 'Alianças Imperiais', awinMerchantId: 106747 },
} as const satisfies Record<string, Partner>;

/**
 * An Awin tracking link that lands on `destination`. `clickref` names the placement, so Awin's
 * reports show which block on the site earned the sale.
 */
export function awinLink(partner: Partner, destination: string, clickref?: string): string {
  const url = new URL(destination);
  if (url.protocol !== 'https:') throw new Error(`Partner links must use https: ${destination}`);
  const params = [`awinmid=${partner.awinMerchantId}`, `awinaffid=${AWIN_PUBLISHER_ID}`];
  if (clickref) params.push(`clickref=${encodeURIComponent(clickref)}`);
  params.push(`ued=${encodeURIComponent(url.toString())}`);
  return `https://www.awin1.com/cread.php?${params.join('&')}`;
}
