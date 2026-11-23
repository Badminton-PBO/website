#!/usr/bin/env node
/**
 * Na `astro build`: maakt de afbeeldingen uit public/ lichter in de pagina's (nieuwsberichten, affiche van het PK).
 *
 * - `width` en `height` op elke <img>, zodat de pagina niet verspringt tijdens het laden;
 * - `loading="lazy"` vanaf de tweede afbeelding van een pagina;
 * - een grote afbeelding (breder dan 1600 px of zwaarder dan 300 kB) krijgt een verkleinde WebP in dist/_verkleind/
 *   en de pagina toont die. Het origineel blijft op zijn pad staan, voor links van buitenaf en "klik om te vergroten".
 *
 * Zo mag een beheerder een foto recht van de telefoon uploaden (5 MB): de bezoeker krijgt er een van enkele honderden kB.
 * Afbeeldingen via astro:assets (logo, sponsors, bestuur) staan in /_astro/, zijn al verkleind en blijven ongemoeid.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './oude-site.mjs';

const DIST = join(ROOT, 'dist');
/** Basispad van de build (GitHub Pages: /website); in de html staat het voor elk pad. */
const BASIS = (process.env.BASE_PATH || '/').replace(/\/+$/, '');
/** Mappen uit public/ met afbeeldingen: uploads van het beheer en de bestanden uit WordPress. */
const MAPPEN = /^\/(uploads|wp-content)\//;
/** De tekstkolom van een bericht is 808 px breed; 1600 px volstaat voor scherpe schermen. */
const MAX_BREED = 1600;
const MAX_BYTES = 300_000;

let verkleind = 0;
let voor = 0;
let na = 0;

/** Afmetingen van een afbeelding en het pad dat de pagina moet tonen (het origineel of de verkleinde versie). */
async function verwerk(pad) {
  const bron = join(DIST, decodeURIComponent(pad));
  if (!/\.(jpe?g|png|webp)$/i.test(pad) || !existsSync(bron)) return null;
  try {
    const bytes = await readFile(bron);
    const meta = await sharp(bytes).metadata();
    // Foto's van een telefoon liggen vaak op hun kant, met de draairichting in de EXIF-gegevens.
    const gedraaid = (meta.orientation ?? 1) >= 5;
    const [width, height] = gedraaid ? [meta.height, meta.width] : [meta.width, meta.height];
    const origineel = { src: pad, width, height };
    if (width <= MAX_BREED && bytes.length <= MAX_BYTES) return origineel;

    const klein = await sharp(bytes)
      .rotate()
      .resize({ width: MAX_BREED, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    if (klein.data.length >= bytes.length) return origineel;
    // Een hash van het origineel in de naam: vervangt iemand het bestand, dan verandert het adres (zie cache in .htaccess).
    const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8);
    const src = `/_verkleind${pad.replace(/\.\w+$/, '')}.${hash}.webp`;
    const doel = join(DIST, decodeURIComponent(src));
    await mkdir(dirname(doel), { recursive: true });
    await writeFile(doel, klein.data);
    verkleind++;
    voor += bytes.length;
    na += klein.data.length;
    return { src, width: klein.info.width, height: klein.info.height };
  } catch (fout) {
    console.warn(`afbeeldingen: ${pad} overgeslagen (${fout.message})`);
    return null;
  }
}

const gezien = new Map();
const info = (pad) => gezien.get(pad) ?? gezien.set(pad, verwerk(pad)).get(pad);

const attribuut = (tag, naam) => new RegExp(`\\s${naam}=`).test(tag);
const metAttributen = (tag, extra) => tag.replace(/\s*\/?>$/, (einde) => ` ${extra}${einde.trim() === '/>' ? ' />' : '>'}`);

/** Eén pagina: elke <img> uit public/ krijgt afmetingen, lazy loading en zo nodig de verkleinde versie. */
async function pagina(bestand) {
  const html = await readFile(bestand, 'utf8');
  const tags = [...html.matchAll(/<img\b[^>]*>/g)];
  let inhoud = 0;
  const nieuw = await Promise.all(
    tags.map(async ([tag]) => {
      const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
      const pad = src && BASIS && src.startsWith(`${BASIS}/`) ? src.slice(BASIS.length) : src;
      if (!pad || !MAPPEN.test(pad)) return tag;
      const eerste = inhoud++ === 0;
      const beeld = await info(pad);
      let t = tag;
      const extra = [];
      if (beeld && !attribuut(tag, 'srcset')) {
        if (beeld.src !== pad) t = t.replace(` src="${src}"`, ` src="${BASIS}${beeld.src}"`);
        if (!attribuut(tag, 'width') && !attribuut(tag, 'height')) extra.push(`width="${beeld.width}"`, `height="${beeld.height}"`);
      }
      // De eerste afbeelding staat vaak meteen in beeld: die laadt de browser best direct.
      if (!eerste && !attribuut(tag, 'loading')) extra.push('loading="lazy"');
      if (!attribuut(tag, 'decoding')) extra.push('decoding="async"');
      return extra.length ? metAttributen(t, extra.join(' ')) : t;
    }),
  );
  if (!inhoud) return 0;
  let i = 0;
  const resultaat = html.replace(/<img\b[^>]*>/g, () => nieuw[i++]);
  if (resultaat !== html) await writeFile(bestand, resultaat);
  return inhoud;
}

async function* htmlBestanden(map) {
  for (const item of await readdir(map, { withFileTypes: true })) {
    const pad = join(map, item.name);
    if (item.isDirectory()) yield* htmlBestanden(pad);
    else if (item.name.endsWith('.html')) yield pad;
  }
}

let beelden = 0;
for await (const bestand of htmlBestanden(DIST)) beelden += await pagina(bestand);

const mb = (n) => (n / 1e6).toFixed(1).replace('.', ',');
console.log(
  `afbeeldingen: ${beelden} in de pagina's, ${verkleind} verkleind${verkleind ? ` (${mb(voor)} MB → ${mb(na)} MB)` : ''}`,
);
