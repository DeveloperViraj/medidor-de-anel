/**
 * Structured data (schema.org JSON-LD), emitted once per page as a single @graph.
 *
 * Every page carries the same Organization and WebSite entities under stable @ids, plus a WebPage
 * node, a BreadcrumbList below the home page, and whatever the page adds (the WebApplication on the
 * tool pages).
 *
 * Deliberately absent: aggregateRating (we have no real ratings, and Google's guidelines forbid
 * self-serving ones), HowTo (retired in 2023) and a named author (none until the owner chooses).
 * FAQPage stays on pages with real questions: Google stopped showing FAQ rich results in May 2026,
 * but the markup still describes the page accurately.
 */

import { SITE } from '../config/site';

export interface Crumb {
  name: string;
  /** Site-relative path, e.g. "/tabela-de-medidas-de-anel". */
  path: string;
}

export type JsonLdNode = Record<string, unknown>;

export const ORGANIZATION_ID = `${SITE.url}/#organization`;
export const WEBSITE_ID = `${SITE.url}/#website`;

/**
 * The public path of a page from Astro's URL. Builds use `format: 'file'`, so pages arrive as
 * "/sobre.html" and the home page as "/index.html"; Cloudflare Pages serves them at "/sobre" and "/".
 */
export function pagePath(pathname: string): string {
  const path = pathname
    .replace(/\.html$/, '')
    .replace(/(^|\/)index$/, '$1')
    .replace(/(.)\/$/, '$1');
  return path || '/';
}

/** Absolute URL without a trailing slash (the site serves /sobre, not /sobre/), except the root. */
export function absolute(path: string): string {
  const url = new URL(path, SITE.url).toString();
  return path === '/' ? url : url.replace(/\/$/, '');
}

export function organization(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE.name,
    url: SITE.url,
    logo: { '@type': 'ImageObject', url: absolute('/icon-512.png'), width: 512, height: 512 },
    ...(SITE.contactEmail ? { email: SITE.contactEmail } : {}),
  };
}

export function website(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE.name,
    alternateName: 'Medidor de anel online',
    url: SITE.url,
    inLanguage: SITE.locale,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function breadcrumbList(crumbs: readonly Crumb[], pageUrl: string): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absolute(crumb.path),
    })),
  };
}

export function webPage(opts: {
  url: string;
  title: string;
  description: string;
  hasBreadcrumb: boolean;
}): JsonLdNode {
  return {
    '@type': 'WebPage',
    '@id': `${opts.url}#webpage`,
    url: opts.url,
    name: opts.title,
    description: opts.description,
    inLanguage: SITE.locale,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
    ...(opts.hasBreadcrumb ? { breadcrumb: { '@id': `${opts.url}#breadcrumb` } } : {}),
  };
}

/** The ring sizer itself: free, in the browser, no sign-up. */
export function webApplication(opts: {
  url: string;
  name: string;
  description: string;
}): JsonLdNode {
  return {
    '@type': 'WebApplication',
    '@id': `${opts.url}#app`,
    name: opts.name,
    description: opts.description,
    url: opts.url,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Qualquer navegador (Android, iPhone, computador)',
    browserRequirements: 'Requer JavaScript',
    inLanguage: SITE.locale,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export interface Faq {
  q: string;
  /** Plain text: the same words the page shows. */
  a: string;
}

export function faqPage(url: string, faqs: readonly Faq[]): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
