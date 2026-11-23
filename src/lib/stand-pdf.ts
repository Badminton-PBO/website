/**
 * Leest de standen uit de pdf van de jeugdcup (Excel, opgeslagen als pdf): één upload in plaats van tien keer plakken.
 *
 * In die pdf is elke cel een apart stukje tekst met een vaste plaats. Per pagina:
 * - de reeks staat rechtsboven ("Minibad jongens", "Jongens U11", "Meisjes U17 en U19"); een reeks loopt soms over
 *   meerdere pagina's, telkens met dezelfde titel;
 * - een rij begint met de positie en eindigt met het totaal. De eerste tekstcel is de naam, de tweede de club.
 *   Lidnummer en punten per halte ertussen tellen niet mee, zoals bij een geplakte stand (src/lib/stand.ts).
 *
 * Hangt af van het Excel-sjabloon van de jeugdcup: getest op alle pdf's van 2025 en 2026. Verandert het sjabloon, dan
 * vindt de lezer minder of niets, en dat zegt `problemen` (in het Nederlands, voor het voorbeeld in het beheer).
 *
 * Zonder pdf.js zelf: de build (src/lib/jeugdcup.ts) en het beheer (src/scripts/admin-pdf.ts) laden elk hun versie
 * en geven die door aan `leesStandenPdf`.
 */
import { getal, type Rij } from './stand';
import { geslachten, type CategorieId, type ReeksSleutel } from './jeugdcup-labels';

/** Wat we van pdf.js nodig hebben: zo werkt de lezer met de build voor Node en met die voor de browser. */
interface PdfTekst {
  str?: string;
  transform?: number[];
}
export interface PdfJs {
  getDocument(bron: { data: Uint8Array; verbosity?: number }): {
    promise: Promise<{
      numPages: number;
      getPage(nr: number): Promise<{ getTextContent(): Promise<{ items: PdfTekst[] }> }>;
    }>;
    destroy(): Promise<void>;
  };
}

/** Eén stukje tekst op een pagina: x van links, y van onder (pdf-punten). */
export interface Cel {
  tekst: string;
  x: number;
  y: number;
}

export interface PdfStanden {
  standen: Partial<Record<ReeksSleutel, Rij[]>>;
  /** Het toernooi zoals het bovenaan elke pagina staat, zonder "Na": "Gentse BC". */
  na?: string;
  /** Wat de lezer niet kon plaatsen. Leeg als alles herkend is. */
  problemen: string[];
}

/**
 * Hoort de pdf bij een ander toernooi dan het gekozen? In de pdf staat "Na Gentse BC", het id van de halte is
 * <datum>-gentse-bc. De clubs worden niet overal gelijk geschreven ("Na Wit Wit" bij Wit-Wit Ronse), dus enkel waar
 * als geen enkel woord van de halte (drie letters of meer) in de titel van de pdf staat. Voor een vraag aan de user,
 * niet om te weigeren.
 */
export function anderToernooi(na: string | undefined, halteId: string): boolean {
  if (!na) return false;
  const letters = (s: string) =>
    s
      .normalize('NFD')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  const woorden = halteId
    .slice(11)
    .split('-')
    .filter((w) => w.length >= 3 && w !== 'badminton');
  return woorden.length > 0 && !woorden.some((w) => letters(na).includes(w));
}

const categoriePatroon: [CategorieId, RegExp][] = [
  ['minibad', /minibad/i],
  ['u17-u19', /u\s*1[79]/i],
  ['u15', /u\s*15/i],
  ['u13', /u\s*13/i],
  ['u11', /u\s*11/i],
];

/** "Jongens U17 en U19" → "u17-u19-jongens". Tekst zonder categorie of zonder jongens/meisjes: undefined. */
export function reeksUitTitel(titel: string): ReeksSleutel | undefined {
  const geslacht = geslachten.find((g) => new RegExp(g.id, 'i').test(titel))?.id;
  const categorie = categoriePatroon.find(([, p]) => p.test(titel))?.[0];
  return geslacht && categorie ? `${categorie}-${geslacht}` : undefined;
}

/** Cellen op dezelfde hoogte vormen een rij (in de pdf staan ze exact gelijk; een rij is ruim 10 punten hoog). */
function rijenVan(cellen: Cel[]): Cel[][] {
  const rijen: Cel[][] = [];
  let hoogte = Infinity;
  for (const c of [...cellen].sort((a, b) => b.y - a.y)) {
    if (Math.abs(hoogte - c.y) > 3) rijen.push([]);
    rijen.at(-1)!.push(c);
    hoogte = c.y;
  }
  return rijen.map((r) => r.sort((a, b) => a.x - b.x));
}

/** De standen uit de tekst van alle pagina's. Los van pdf.js, zodat het te testen is. */
export function standenUitPaginas(paginas: Cel[][]): PdfStanden {
  const standen: PdfStanden['standen'] = {};
  const problemen: string[] = [];

  paginas.forEach((cellen, p) => {
    const reeks = cellen.map((c) => reeksUitTitel(c.tekst)).find(Boolean);
    let zonderReeks = 0;
    for (const rij of rijenVan(cellen)) {
      let teksten = rij.map((c) => c.tekst);
      // Positie en naam soms in één stukje tekst: "12 Elias De Vlieger".
      const samen = /^(\d+)\s+(\D.*)$/.exec(teksten[0]);
      if (samen) teksten = [samen[1], samen[2], ...teksten.slice(1)];
      if (teksten.length < 3 || !/^\d+$/.test(teksten[0])) continue;

      const [naam, club] = teksten.slice(1).filter((t) => getal(t) === undefined);
      const getallen = teksten.slice(1).filter((t) => getal(t) !== undefined);
      if (!naam) continue;
      // Enkel een lidnummer na de club: de rij heeft geen totaal.
      const punten = getallen.length === 1 && /^\d{6,}$/.test(getallen[0]) ? undefined : getal(teksten.at(-1)!);
      if (punten === undefined) {
        problemen.push(`Pagina ${p + 1}: geen totaal gevonden bij ${naam}.`);
        continue;
      }
      if (!reeks) {
        zonderReeks++;
        continue;
      }
      (standen[reeks] ??= []).push({ pos: Number(teksten[0]), naam, club, punten });
    }
    if (zonderReeks)
      problemen.push(
        `Pagina ${p + 1}: ${zonderReeks} ${zonderReeks === 1 ? 'rij' : 'rijen'} zonder reeks. Rechtsboven moet de reeks staan, bv. "Jongens U13".`,
      );
  });

  // "Na Gentse BC" staat op elke pagina: de tekst die het vaakst voorkomt (een speler kan ook "Na ..." heten).
  const telling = new Map<string, number>();
  for (const c of paginas.flat()) {
    const na = /^na\s+(\S.*)$/i.exec(c.tekst)?.[1];
    if (na) telling.set(na, (telling.get(na) ?? 0) + 1);
  }
  const na = [...telling].sort((a, b) => b[1] - a[1]).at(0)?.[0];
  return { standen, na, problemen };
}

/** Leest een pdf met pdf.js (`pdfjs`: de build voor Node of die voor de browser). Gooit als het geen leesbare pdf is. */
export async function leesStandenPdf(pdfjs: PdfJs, data: Uint8Array): Promise<PdfStanden> {
  // verbosity 0: geen waarschuwingen over lettertypes in de buildlog.
  const taak = pdfjs.getDocument({ data, verbosity: 0 });
  try {
    const doc = await taak.promise;
    const paginas: Cel[][] = [];
    for (let nr = 1; nr <= doc.numPages; nr++) {
      const { items } = await (await doc.getPage(nr)).getTextContent();
      paginas.push(
        items.flatMap((i) => {
          const tekst = i.str?.trim();
          // Gedraaide tekst (de koppen met datum en club van elke halte) hoort niet bij een rij.
          if (!tekst || !i.transform || i.transform[1] !== 0) return [];
          return [{ tekst, x: i.transform[4], y: i.transform[5] }];
        }),
      );
    }
    return standenUitPaginas(paginas);
  } finally {
    await taak.destroy();
  }
}
