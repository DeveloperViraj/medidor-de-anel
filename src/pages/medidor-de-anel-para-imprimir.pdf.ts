/** The printable sizer, rendered once at build time into a static, indexable PDF. */
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';
import { buildPrintableSizer } from '../lib/printable';

export const GET: APIRoute = () =>
  new Response(buildPrintableSizer(SITE.domain), {
    headers: { 'Content-Type': 'application/pdf' },
  });
