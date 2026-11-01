/**
 * Single source of truth for brand + domain. Rename the product by editing this file
 * and `SITE_URL` in astro.config.mjs (Astro config can't import TS at load time).
 */
export const SITE = {
  name: 'Medidor de Anel',
  /** For the home-screen label, which has room for about twelve characters. */
  shortName: 'Medidor',
  domain: 'medidordeanel.com',
  url: 'https://medidordeanel.com',
  tagline: 'Medidor de anel online grátis',
  /** Cloudflare Email Routing forwards it to the owner's inbox, which is never published. */
  contactEmail: 'contato@medidordeanel.com',
  /** Where readers can chip in to keep the site free. Linked from the footer, Sobre and the result. */
  support: {
    label: 'Me pague um café',
    url: 'https://buymeacoffee.com/developerviraj',
  },
  /**
   * Google Search Console's HTML-tag verification code (the content="..." value). Empty because the
   * Domain property verifies through Cloudflare DNS; the tag is only emitted when this is set.
   */
  googleVerification: '',
  locale: 'pt-BR',
  /** Open Graph wants an underscore. */
  ogLocale: 'pt_BR',
} as const;
