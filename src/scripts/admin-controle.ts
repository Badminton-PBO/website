/**
 * Houdt in Decap tegen wat de build zou breken: een toernooi (jeugdcuphalte of PK) met een toernooilink zonder
 * "Inschrijven tot", of met een inschrijfdatum op of na de speeldag. Decap toont de melding en publiceert niet,
 * zodat je het meteen verbetert. Zonder deze controle bouwt de site niet meer en blijft de vorige versie online.
 * Dezelfde regel als in het schema: inschrijfFouten in src/lib/toernooi.ts.
 *
 * Ook een ranking met een pdf waar de site geen standen in vindt, houdt dit tegen (pdfFouten). Dat breekt de build
 * niet, maar er zou niets op de site komen.
 */
import { inschrijfFouten } from '../lib/toernooi';
import { leesStand } from '../lib/stand';
import { reeksen } from '../lib/jeugdcup-labels';
import { pdfBronnen, standenUitPdf, type MediaBestand } from './admin-pdf';

interface Entry {
  get(sleutel: 'collection' | 'slug'): string;
  get(sleutel: 'data'): { toJS(): Record<string, unknown> };
  get(sleutel: 'mediaFiles'): { toJS(): MediaBestand[] } | undefined;
}

const w = window as unknown as {
  CMS?: { registerEventListener(l: { name: string; handler(a: { entry: Entry }): void | Promise<void> }): void };
};

/** Decap geeft een datum als "2026-10-11" (of met een uur erachter); leeg is geen datum. */
const dag = (v: unknown) => {
  const d = v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : '';
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : undefined;
};
const tekst = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

const toernooi = (t: Record<string, unknown>) => ({
  datum: dag(t.datum),
  toernooilink: tekst(t.toernooilink),
  inschrijvenTot: dag(t.inschrijvenTot),
});

function fouten(collectie: string, slug: string, data: Record<string, unknown>): string[] {
  if (collectie === 'kalender') {
    const haltes = Array.isArray(data.haltes) ? (data.haltes as Record<string, unknown>[]) : [];
    return haltes.flatMap((h) => inschrijfFouten(toernooi(h)).map((f) => `Halte ${tekst(h.club) ?? 'zonder club'}: ${f}`));
  }
  if (collectie === 'paginas' && slug === 'pk') return inschrijfFouten(toernooi(data)).map((f) => `PK: ${f}`);
  return [];
}

/**
 * Een ranking met een pdf waar de site geen enkele stand in vindt (verkeerde pdf, of een ander sjabloon), en zonder
 * geplakte stand: publiceren zou niets op de site zetten, zonder dat je het merkt.
 */
async function pdfFouten(entry: Entry, data: Record<string, unknown>): Promise<string[]> {
  const pdf = tekst(data.pdf);
  if (entry.get('collection') !== 'rankings' || !pdf) return [];
  const plakvelden = (data.geplakt ?? {}) as Record<string, unknown>;
  if (reeksen.some((r) => leesStand(tekst(plakvelden[r.sleutel]) ?? '').length)) return [];
  const standen = await standenUitPdf(pdfBronnen(pdf, entry.get('mediaFiles')?.toJS())).then(
    (gelezen) => Object.keys(gelezen.standen).length,
    () => 0,
  );
  return standen ? [] : ['De site vindt geen standen in de pdf. Kies de pdf met de rankings uit Excel, of plak de standen onder "Standen plakken".'];
}

w.CMS?.registerEventListener({
  name: 'preSave',
  handler: async ({ entry }) => {
    const data = entry.get('data').toJS();
    const lijst = [...fouten(entry.get('collection'), entry.get('slug'), data), ...(await pdfFouten(entry, data))];
    if (!lijst.length) return;
    // Decap zet de fout achter "Opslaan mislukt:"; zonder naam staat er geen "Error:" voor.
    const fout = new Error(`${lijst.join(' ')} Niets is gepubliceerd: verbeter het en publiceer opnieuw.`);
    fout.name = '';
    throw fout;
  },
});
