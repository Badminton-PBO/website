#!/usr/bin/env node
/**
 * Verplaatst nieuwsberichten ouder dan zes maanden naar src/content/nieuws/archief/.
 *
 *   npm run archiveer
 *
 * Decap haalt bij het openen van Nieuws elk bericht in de map apart op bij GitHub (twee aanvragen per
 * bericht) en slaat submappen over. Op de site verandert niets: het adres blijft /nieuws/<bestandsnaam>.
 * Blijven staan: uitgelichte berichten (anders kan niemand dat nog uitzetten) en berichten waarvan de
 * bestandsnaam al in het archief staat.
 * Eens per jaar draaien volstaat. Terugzetten: het bestand weer naar src/content/nieuws/ verplaatsen.
 */
import { mkdir, readdir, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, leesFrontmatter } from './oude-site.mjs';

const map = join(ROOT, 'src/content/nieuws');
const archief = join(map, 'archief');
const grens = new Date();
grens.setMonth(grens.getMonth() - 6);
const tot = grens.toISOString().slice(0, 10);

await mkdir(archief, { recursive: true });
const gearchiveerd = new Set(await readdir(archief));
let verplaatst = 0;
let blijft = 0;
for (const bestand of (await readdir(map)).filter((f) => f.endsWith('.md'))) {
  const { date, uitgelicht } = leesFrontmatter(await readFile(join(map, bestand), 'utf8')).data;
  const oud = String(date).slice(0, 10) < tot;
  if (oud && uitgelicht) console.log(`blijft staan (uitgelicht): ${bestand}`);
  else if (oud && gearchiveerd.has(bestand)) console.log(`blijft staan (naam bestaat al in het archief): ${bestand}`);
  else if (oud) {
    await rename(join(map, bestand), join(archief, bestand));
    verplaatst++;
    continue;
  }
  blijft++;
}
console.log(`${verplaatst} berichten van voor ${tot} naar het archief, ${blijft} blijven in het beheer.`);
