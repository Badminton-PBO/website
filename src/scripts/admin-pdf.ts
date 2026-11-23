/**
 * Leest in het beheer de standen uit de pdf die de user bij een ranking uploadt, met dezelfde lezer als de build
 * (src/lib/stand-pdf.ts). Het voorbeeld toont ze vóór het publiceren (admin-preview.ts) en de controle bij het
 * publiceren gebruikt ze (admin-controle.ts).
 *
 * pdf.js is groot (ruim 1 MB met de worker): het laadt pas als er een pdf te lezen valt.
 */
import werker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { leesStandenPdf, type PdfJs, type PdfStanden } from '../lib/stand-pdf';
import { branch, repo } from '../lib/repo';
import { u } from '../lib/url';

/** Een bestand in het concept van Decap (`entry.mediaFiles`): een pas gekozen pdf heeft daar een blob-URL. */
export interface MediaBestand {
  path?: string;
  url?: string;
}

/**
 * Waar de pdf met dit pad (bv. /documenten/jeugdcuptour/x.pdf) te halen is, in volgorde:
 * 1. het concept van Decap: een pdf die pas gekozen is, staat nog nergens online. `getAsset` van Decap geeft in het
 *    voorbeeld enkel het pad terug, dus zoeken we het bestand zelf op in het concept;
 * 2. de site (een ranking die al langer online staat);
 * 3. GitHub (net gepubliceerd, de site is nog niet opnieuw gebouwd).
 */
export function pdfBronnen(pad: string, media: MediaBestand[] = []): string[] {
  const concept = media.find((m) => m.url && m.path && `/${m.path}`.endsWith(`/public${pad}`))?.url;
  const opGitHub = `https://raw.githubusercontent.com/${repo}/${branch}/public${pad.split('/').map(encodeURIComponent).join('/')}`;
  return [...(concept ? [concept] : []), u(pad), opGitHub];
}

async function lees(bronnen: string[]): Promise<PdfStanden> {
  // De "legacy"-build werkt ook in browsers van enkele jaren oud.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = werker;
  let laatste: unknown = new Error('Geen pdf.');
  for (const bron of bronnen) {
    try {
      const antwoord = await fetch(bron);
      if (!antwoord.ok) throw new Error(`${antwoord.status}`);
      // Geen pdf (bv. de 404-pagina van de site): pdf.js gooit, en de volgende bron komt aan de beurt.
      return await leesStandenPdf(pdfjs as unknown as PdfJs, new Uint8Array(await antwoord.arrayBuffer()));
    } catch (fout) {
      laatste = fout;
    }
  }
  throw laatste;
}

const gelezen = new Map<string, Promise<PdfStanden>>();

/** De standen uit de eerste bron die een leesbare pdf geeft. Eén keer lezen per pdf; een mislukte poging mag opnieuw. */
export function standenUitPdf(bronnen: string[]): Promise<PdfStanden> {
  const sleutel = bronnen[0];
  let belofte = gelezen.get(sleutel);
  if (!belofte) {
    belofte = lees(bronnen);
    gelezen.set(sleutel, belofte);
    belofte.catch(() => gelezen.delete(sleutel));
  }
  return belofte;
}
