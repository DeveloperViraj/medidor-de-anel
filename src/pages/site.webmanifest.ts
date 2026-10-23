/** Web app manifest, so "Adicionar à tela inicial" gets a real name and icon. */
import type { APIRoute } from 'astro';
import { BRAND } from '../lib/brand';
import { SITE } from '../config/site';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: `${SITE.name}: ${SITE.tagline}`,
      short_name: SITE.shortName,
      description: 'Descubra o seu aro na tela do celular, sem cadastro, sem app e sem cobrança.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#fbfbfd',
      theme_color: BRAND.tile,
      lang: SITE.locale,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
