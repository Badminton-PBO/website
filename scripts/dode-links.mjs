#!/usr/bin/env node
/**
 * Zoekt interne links en afbeeldingen in de berichten en pagina's (src/content) die nergens meer naartoe wijzen.
 *
 *   node scripts/dode-links.mjs              toont wat dood is, verandert niets
 *   node scripts/dode-links.mjs --verwijder  past de bestanden aan en schrijft scripts/uitvoer/dode-links.md
 *
 * De meeste komen van pbo.kwal.org, de site van voor 2017: de migratie maakte er paden onder /pbo/wp/ van, maar die
 * bestanden bestaan nergens meer (geen back-up). Met --verwijder:
 * - een link naar een oude pagina die een nieuwe plek heeft (OUDE_PAGINAS, KWAL_PAGINAS) krijgt het nieuwe adres;
 * - een dode link verdwijnt, de tekst blijft staan;
 * - een dode afbeelding verdwijnt, samen met de link eromheen.
 * Het rapport houdt bij wat er per bericht stond, voor wie een bestand later toch terugvindt.
 * Dood in een lijst van een vaste pagina (`bestand:`): enkel gemeld, verwijder het item in het beheer.
 */
import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { OUDE_PAGINAS, ROOT } from './oude-site.mjs';

const VERWIJDER = process.argv.includes('--verwijder');
const CONTENT = join(ROOT, 'src/content');

/** Pagina's van pbo.kwal.org (/pbo/wp/<pad>) die op de nieuwe site een plek hebben. */
const KWAL_PAGINAS = {
  '/pbo-jeugdcuptour-praktisch': '/jeugd/jeugdcuptour',
  '/pbo-calender': '/bestuur#kalender',
  '/pbo-recreantencup': '/recreanten',
  '/recreantentornooi': '/recreanten',
};
const PAGINAS = { ...OUDE_PAGINAS, ...KWAL_PAGINAS };

// ---------------------------------------------------------------- wat bestaat er

async function lijst(map, filter) {
  return (await readdir(map, { recursive: true })).map((f) => f.replaceAll('\\', '/')).filter(filter);
}

/** Routes van de site: de pagina's in src/pages en elk nieuwsbericht. Routes met een parameter volgen als patroon. */
const routes = new Set(['/']);
for (const f of await lijst(join(ROOT, 'src/pages'), (f) => f.endsWith('.astro') && !f.includes('[') && !f.startsWith('admin'))) {
  routes.add(`/${f.replace(/\.astro$/, '').replace(/(^|\/)index$/, '')}`.replace(/\/$/, '') || '/');
}
const berichten = await lijst(join(CONTENT, 'nieuws'), (f) => f.endsWith('.md'));
for (const f of berichten) routes.add(`/nieuws/${basename(f, '.md')}`);
const ROUTE_PATROON = /^\/(nieuws\/archief|jeugd\/jeugdcuptour\/ranking)\/\d{4}$/;

const zonderStaart = (pad) => pad.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

function bestaat(doel) {
  const pad = zonderStaart(doel);
  if (routes.has(pad) || ROUTE_PATROON.test(pad)) return true;
  let bestand;
  try {
    bestand = join(ROOT, 'public', decodeURIComponent(pad));
  } catch {
    return false;
  }
  return existsSync(bestand) && statSync(bestand).isFile();
}

/**
 * Een intern doel: blijft (`ok`), krijgt een nieuw adres (`nieuw`) of is dood. Andere sites, mailto: en ankers
 * (alles wat niet met één / begint) blijven zoals ze zijn.
 */
function beoordeel(doel) {
  if (!doel.startsWith('/') || doel.startsWith('//')) return { ok: doel };
  if (bestaat(doel)) return { ok: doel };
  // Een andere site waar het protocol van wegviel: /www.vkbadminton.be
  if (/^\/www\.[\w-]+\.\w+/.test(doel)) return { nieuw: `http://${doel.slice(1)}` };
  const oud = doel.replace(/^\/pbo\/wp(?=\/)/, '');
  const pagina = PAGINAS[zonderStaart(oud)];
  if (pagina) return { nieuw: pagina };
  // Een pagina of bestand dat zonder /pbo/wp wel bestaat, bv. /pbo/wp/vacatures/.
  if (oud !== doel && bestaat(oud)) return { nieuw: zonderStaart(oud).startsWith('/wp-content/') ? oud : zonderStaart(oud) };
  return { dood: doel };
}

// ---------------------------------------------------------------- Markdown

/** Adres tussen de haakjes van een Markdown-link: zonder spaties, met hoogstens één paar haakjes erin, of tussen < >. */
const ADRES = String.raw`(<[^>]*>|[^()\s]*(?:\([^()\s]*\)[^()\s]*)*)`;
const TITEL = String.raw`(\s+"[^"]*")?`;
const BEELD = String.raw`!\[([^\]]*)\]\(${ADRES}${TITEL}\)`;
const BEELD_IN_LINK = new RegExp(String.raw`\[${BEELD}\]\(${ADRES}${TITEL}\)`, 'g');
const LOS_BEELD = new RegExp(BEELD, 'g');
const LINK = new RegExp(String.raw`(?<!!)\[((?:[^\[\]\\]|\\.)*)\]\(${ADRES}${TITEL}\)`, 'g');

/** Staat tijdelijk op de plaats van wat verwijderd is, om er daarna rond op te ruimen. */
const WEG = String.fromCharCode(0);

/** De tekst van één bestand zonder dode links; `log` krijgt een regel per ingreep. */
function kuis(tekst, log) {
  const adres = (doel, wat) => {
    const b = beoordeel(doel);
    if (b.nieuw) log.push(`${wat} \`${doel}\` → \`${b.nieuw}\``);
    return b;
  };
  const beeld = (alt, doel, titel = '') => `![${alt}](${doel}${titel})`;

  let uit = tekst.replace(BEELD_IN_LINK, (alles, alt, src, srcTitel, href, hrefTitel = '') => {
    const b = adres(src, 'afbeelding');
    if (b.dood) {
      log.push(`afbeelding verwijderd: \`${src}\``);
      return WEG;
    }
    const l = adres(href, 'link');
    if (l.dood) {
      log.push(`link rond afbeelding verwijderd: \`${href}\``);
      return beeld(alt, b.ok ?? b.nieuw, srcTitel);
    }
    return `[${beeld(alt, b.ok ?? b.nieuw, srcTitel)}](${l.ok ?? l.nieuw}${hrefTitel})`;
  });
  uit = uit.replace(LOS_BEELD, (alles, alt, src, titel) => {
    const b = adres(src, 'afbeelding');
    if (!b.dood) return beeld(alt, b.ok ?? b.nieuw, titel);
    log.push(`afbeelding verwijderd: \`${src}\``);
    return WEG;
  });
  uit = uit.replace(LINK, (alles, linktekst, href, titel = '') => {
    const l = adres(href, 'link');
    if (!l.dood) return `[${linktekst}](${l.ok ?? l.nieuw}${titel})`;
    log.push(`link verwijderd: "${linktekst.replaceAll('\\', '')}" → \`${href}\``);
    return linktekst || WEG;
  });
  if (uit === tekst) return tekst;
  // Enkel opruimen rond wat verdween (WEG): de rest van de tekst blijft teken voor teken zoals hij was, ook de
  // twee spaties aan het einde van een regel (in Markdown een regeleinde).
  return (
    uit
      // Nadruk rond een afbeelding die weg is: **![](x)**
      .replace(new RegExp(String.raw`(\*\*|__|\*|_)${WEG}\1`, 'g'), WEG)
      // Een regel met enkel de afbeelding.
      .replace(new RegExp(String.raw`(\r?\n)(?:[ \t]*${WEG})+[ \t]*(?=\r?\n|$)`, 'g'), '')
      .replaceAll(WEG, '')
      .replace(/(\r?\n)(?:[ \t]*\r?\n){2,}/g, '$1$1')
      .replace(/^(\r?\n)(?:[ \t]*\r?\n)+/, '$1')
  );
}

// ---------------------------------------------------------------- bestanden

const rapport = [];
let aangepast = 0;
let ingrepen = 0;
const handmatig = [];

for (const f of await lijst(CONTENT, (f) => f.endsWith('.md'))) {
  const pad = join(CONTENT, f);
  const bron = await readFile(pad, 'utf8');
  const [, kop = '', tekst = bron] = bron.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/) ?? [];
  // Bestanden in de lijsten van een vaste pagina (documenten, archief, affiche).
  for (const [, doel] of kop.matchAll(/^\s*-?\s*(?:bestand|pdf|affiche|foto):\s*["']?(\/[^\s"']+)/gm)) {
    if (!bestaat(doel)) handmatig.push(`${f}: \`${doel}\``);
  }
  const log = [];
  const nieuw = kuis(tekst, log);
  if (!log.length) continue;
  aangepast++;
  ingrepen += log.length;
  rapport.push(`### ${f}`, '', ...log.map((r) => `- ${r}`), '');
  if (VERWIJDER) await writeFile(pad, kop + nieuw);
}

console.log(
  VERWIJDER
    ? `dode links: ${ingrepen} ingrepen in ${aangepast} bestanden`
    : `dode links: ${ingrepen} te doen in ${aangepast} bestanden (pas aan met --verwijder)`,
);
if (handmatig.length) console.log(`dood in een lijst van een pagina, zelf te verwijderen:\n${handmatig.map((r) => `  ${r}`).join('\n')}`);

if (VERWIJDER && rapport.length) {
  const uit = join(ROOT, 'scripts/uitvoer/dode-links.md');
  await mkdir(join(ROOT, 'scripts/uitvoer'), { recursive: true });
  await writeFile(
    uit,
    [
      '# Verwijderde dode links',
      '',
      `${new Date().toISOString().slice(0, 10)} · ${ingrepen} ingrepen in ${aangepast} bestanden (\`node scripts/dode-links.mjs --verwijder\`).`,
      '',
      'De bestanden onder `/pbo/wp/` stonden op pbo.kwal.org en bestaan niet meer. Vind je er toch een terug, zet het dan',
      'in `public/wp-content/uploads/...` en zet de link of afbeelding terug in het bericht.',
      '',
      ...rapport,
    ].join('\n'),
  );
  console.log('rapport: scripts/uitvoer/dode-links.md');
} else if (!VERWIJDER) {
  console.log(rapport.join('\n'));
}
