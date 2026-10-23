// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

// Keep in sync with SITE.url in src/config/site.ts
const SITE_URL = 'https://medidordeanel.com';

const FIGTREE = '@fontsource-variable/figtree/files';
const NEWSREADER = '@fontsource-variable/newsreader/files';
// Unicode ranges as published by Fontsource for these subsets. Portuguese (ã, õ, ç, á, ê…) is in
// the Latin subset, so the Latin Extended file only downloads for rarer characters.
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/**
 * @param {string} dir
 * @param {string} file e.g. "figtree-{subset}-wght-normal.woff2"
 * @param {string} weight
 * @returns {any}
 */
const variants = (dir, file, weight) => [
  {
    weight,
    style: 'normal',
    src: [`${dir}/${file.replace('{subset}', 'latin')}`],
    unicodeRange: [LATIN],
  },
  {
    weight,
    style: 'normal',
    src: [`${dir}/${file.replace('{subset}', 'latin-ext')}`],
    unicodeRange: [LATIN_EXT],
  },
];

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  build: {
    // /sobre -> sobre.html, which Cloudflare Pages serves at /sobre with no trailing slash.
    format: 'file',
  },
  fonts: [
    {
      // Self-hosted from node_modules: no third-party font requests at runtime (OFL fonts).
      provider: fontProviders.local(),
      name: 'Figtree',
      cssVariable: '--font-figtree',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      options: { variants: variants(FIGTREE, 'figtree-{subset}-wght-normal.woff2', '300 900') },
    },
    {
      // The weight-only file (58 KB) rather than the optical-size one (132 KB): headings only,
      // and the phone on a slow connection matters more than the display cut.
      provider: fontProviders.local(),
      name: 'Newsreader',
      cssVariable: '--font-newsreader',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: variants(NEWSREADER, 'newsreader-{subset}-wght-normal.woff2', '200 800'),
      },
    },
  ],
  integrations: [
    icon(),
    sitemap({
      filter: (page) => !/\/(404|500)$/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
