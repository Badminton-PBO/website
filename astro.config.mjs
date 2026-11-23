// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import { basisPlugin } from './src/lib/markdown-basis.mjs';

const base = process.env.BASE_PATH || '/';

// SITE_URL en BASE_PATH komen van de GitHub Pages-workflow (https://badminton-pbo.github.io en /website).
// Zonder die variabelen bouwt de site voor www.badminton-pbo.be.
export default defineConfig({
  site: process.env.SITE_URL || 'https://www.badminton-pbo.be',
  base,
  trailingSlash: 'ignore',
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],
  markdown: {
    processor: satteri({ hastPlugins: [basisPlugin(base)] }),
  },
  vite: {
    plugins: [tailwindcss()],
    // pdf.js (ruim 500 kB) leest in het beheer de rankings uit de pdf. Het laadt enkel daar en pas als er een pdf
    // gekozen is (src/scripts/admin-pdf.ts): geen waarschuwing over een groot bestand bij elke build.
    build: { chunkSizeWarningLimit: 700 },
  },
});
