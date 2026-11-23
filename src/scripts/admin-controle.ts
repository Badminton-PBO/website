/**
 * Houdt in Decap tegen wat de build zou breken: een toernooi (jeugdcuphalte of PK) met een toernooilink zonder
 * "Inschrijven tot", of met een inschrijfdatum op of na de speeldag. Decap toont de melding en publiceert niet,
 * zodat je het meteen verbetert. Zonder deze controle bouwt de site niet meer en blijft de vorige versie online.
 * Dezelfde regel als in het schema: inschrijfFouten in src/lib/toernooi.ts.
 */
import { inschrijfFouten } from '../lib/toernooi';

interface Entry {
  get(sleutel: 'collection' | 'slug'): string;
  get(sleutel: 'data'): { toJS(): Record<string, unknown> };
}

const w = window as unknown as {
  CMS?: { registerEventListener(l: { name: string; handler(a: { entry: Entry }): void }): void };
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

w.CMS?.registerEventListener({
  name: 'preSave',
  handler: ({ entry }) => {
    const lijst = fouten(entry.get('collection'), entry.get('slug'), entry.get('data').toJS());
    if (!lijst.length) return;
    // Decap zet de fout achter "Opslaan mislukt:"; zonder naam staat er geen "Error:" voor.
    const fout = new Error(`${lijst.join(' ')} Niets is gepubliceerd: verbeter het en publiceer opnieuw.`);
    fout.name = '';
    throw fout;
  },
});
