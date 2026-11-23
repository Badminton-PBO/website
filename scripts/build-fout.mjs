#!/usr/bin/env node
/**
 * Na een mislukte build in GitHub Actions: haalt de reden uit het buildlog en geeft ze door als annotatie.
 *
 *   node scripts/build-fout.mjs build.log
 *
 * Het beheer (/admin) leest die annotatie en toont ze bij "Publiceren mislukt" (src/scripts/admin-status.ts).
 * De meldingen van het schema (src/content.config.ts) en van src/lib/ zijn in het Nederlands geschreven, voor wie
 * de site beheert: "Halte Gentse BC: vul "Inschrijven tot" in bij de toernooilink."
 */
import { readFile } from 'node:fs/promises';

/** Dezelfde titel als TITEL_REDEN in src/scripts/admin-status.ts. */
const TITEL = 'Publiceren mislukt';

const log = await readFile(process.argv[2] ?? 'build.log', 'utf8').catch(() => '');
// Zonder kleurcodes van de terminal.
const regels = log.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);

/** De fout staat net boven de eerste "Hint:" of "Stack trace:" van Astro, tot aan de vorige logregel ("12:45:07 [build] ..."). */
function reden() {
  const einde = regels.findIndex((r) => /^\s*(Hint|Error reference|Location|Stack trace):/.test(r));
  if (einde === -1) return regels.filter((r) => r.trim()).slice(-6);
  const blok = [];
  for (let i = einde - 1; i >= 0; i--) {
    if (/^\d{2}:\d{2}:\d{2} /.test(regels[i]) || /^\s*generating static routes/.test(regels[i])) break;
    if (regels[i].trim()) blok.unshift(regels[i].trim());
  }
  return blok.map((r) =>
    r
      // "[InvalidContentEntryDataError] kalender → 2026-2027 data does not match collection schema."
      .replace(/^\[\w+\]\s*(.+?) data does not match collection schema\.$/, 'In $1:')
      .replace(/^\[\w+\]\s*/, ''),
  );
}

const tekst = reden().join('\n').slice(0, 1500).trim();
if (tekst) {
  // Opmaak van GitHub Actions: https://docs.github.com/actions/reference/workflow-commands-for-github-actions
  const veilig = tekst.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::error title=${TITEL}::${veilig}`);
}
