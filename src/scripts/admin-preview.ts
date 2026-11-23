/**
 * Voorbeeld rechts in Decap, in de stijl van de site (src/styles/admin-preview.css).
 * - Nieuws: het bericht zoals op /nieuws/<slug>.
 * - Jeugdcup-ranking: de standen van één toernooi zoals de site ze leest, uit de pdf (src/lib/stand-pdf.ts, gelezen
 *   door admin-pdf.ts) of geplakt (src/lib/stand.ts), met dezelfde code als de site. Zo zie je voor het publiceren
 *   of de pdf gelezen is en welke reeksen ontbreken.
 */
import stijl from '../styles/admin-preview.css?url';
import { leesStand, toonPunten, type Rij } from '../lib/stand';
import { anderToernooi, type PdfStanden } from '../lib/stand-pdf';
import { reeksen } from '../lib/jeugdcup-labels';
import { categorieNaam } from '../lib/nieuws-labels';
import { lang } from '../lib/datum';
import { metBasispad } from './admin-basispad';
import { toernooiNaam } from './admin-toernooien';
import { pdfBronnen, standenUitPdf, type MediaBestand } from './admin-pdf';

type H = (tag: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => unknown;
interface Entry {
  get(sleutel: string): unknown;
  getIn(path: string[]): unknown;
}
interface VoorbeeldProps {
  entry: Entry;
  widgetFor(veld: string): unknown;
}

const w = window as unknown as {
  CMS?: {
    registerPreviewStyle(url: string): void;
    registerPreviewTemplate(name: string, component: (props: VoorbeeldProps) => unknown): void;
  };
  h?: H;
  createClass?(spec: object): unknown;
};

/**
 * Decap zet de tekst in een eigen div: die krijgt de klassen van de lopende tekst.
 * Afbeeldingen uit public/ (bv. /wp-content/uploads/...) krijgen het basispad, zoals op de site.
 */
function tekstOpmaken(el: HTMLElement | null) {
  el?.firstElementChild?.classList.add('prose-pbo', 'prose-nieuws', 'max-w-none', 'm-0');
  metBasispad(el);
}

/** Zelfde opbouw en klassen als src/pages/nieuws/[slug].astro. */
function NieuwsVoorbeeld({ entry, widgetFor }: VoorbeeldProps) {
  const h = w.h!;
  const veld = (naam: string) => String(entry.getIn(['data', naam]) ?? '');
  const datum = veld('date').slice(0, 10);
  return h(
    'article',
    { className: 'mx-auto w-full max-w-[808px] px-5 py-8' },
    h(
      'p',
      { className: 'mb-5 flex flex-wrap items-center gap-3' },
      h('span', { className: 'rounded-full bg-accent-soft px-3.5 py-1.5 text-[13px] font-bold tracking-[0.06em] text-brand uppercase' }, categorieNaam(veld('category'))),
      /^\d{4}-\d{2}-\d{2}$/.test(datum) && h('time', { className: 'text-muted' }, lang(datum)),
    ),
    h('h1', { className: 'mb-7 text-[36px] leading-[1.06] font-extrabold tracking-[-0.02em]' }, veld('title') || 'Titel'),
    // Een nieuwe functie per render, zodat React ze na elke wijziging van de tekst opnieuw oproept.
    h('div', { ref: (el: HTMLElement | null) => tekstOpmaken(el) }, widgetFor('body')),
  );
}

/** Icoon voor een statusmelding: een vinkje (alles gevonden) of een uitroepteken (kijk na). */
function icoon(h: H, soort: 'ok' | 'let-op') {
  const lijn = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return h(
    'svg',
    { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': true, ...lijn },
    h('circle', { cx: 12, cy: 12, r: 9 }),
    soort === 'ok' ? h('path', { d: 'm8 12.5 2.8 2.8L16 9.5' }) : h('path', { d: 'M12 7.5v5.5M12 16.5v.01' }),
  );
}

/** Eén melding bovenaan het voorbeeld: wat de site gevonden heeft en wat de user nu doet. */
function status(h: H, soort: 'ok' | 'let-op' | 'neutraal', titel: string, uitleg?: string) {
  return h(
    'div',
    { key: titel, className: `standen-status${soort === 'let-op' ? ' standen-status--let-op' : ''}`, role: soort === 'let-op' ? 'alert' : 'status' },
    soort !== 'neutraal' && icoon(h, soort),
    h('p', null, h('strong', null, titel), uitleg && ` ${uitleg}`),
  );
}

/** Wat de site voor één reeks toont: de stand uit de pdf of de geplakte, en wat er niet klopt. */
interface Reeks {
  sleutel: string;
  titel: string;
  rijen: Rij[];
  geplakt: boolean;
  opmerking?: string;
}

/** Zelfde keuze als de site (alleStanden in src/lib/jeugdcup.ts): een geplakte stand met rijen gaat voor op de pdf. */
function reeksVoor(r: (typeof reeksen)[number], tekst: string, uitPdf: Rij[]): Reeks {
  const basis = { sleutel: r.sleutel, titel: r.titel };
  const plak = tekst.trim() ? leesStand(tekst) : [];
  if (plak.length) {
    const regels = tekst.split(/\r?\n/).filter((regel) => regel.trim());
    // De kopregel uit Excel mag mee: die ene regel bovenaan is geen opmerking waard.
    const kopregel = leesStand(regels[0]).length === 0 ? 1 : 0;
    const overgeslagen = regels.length - plak.length - kopregel;
    const opmerking =
      overgeslagen > 0
        ? `${overgeslagen} ${overgeslagen === 1 ? 'geplakte regel' : 'geplakte regels'} overgeslagen: geen punten in de laatste kolom (bv. de kopregel). Klopt dat?`
        : undefined;
    return { ...basis, rijen: plak, geplakt: true, opmerking };
  }
  const nietHerkend = tekst.trim() ? 'De geplakte tekst is niet herkend. Plak de kolommen positie, naam, club en punten uit Excel.' : undefined;
  return { ...basis, rijen: uitPdf, geplakt: false, opmerking: nietHerkend && (uitPdf.length ? `${nietHerkend} De site neemt nu de stand uit de pdf.` : nietHerkend) };
}

const spelers = (n: number) => `${n} ${n === 1 ? 'speler' : 'spelers'}`;
const opsomming = (lijst: string[]) => (lijst.length > 1 ? `${lijst.slice(0, -1).join(', ')} en ${lijst.at(-1)}` : (lijst[0] ?? ''));

/** De volledige stand van één reeks, zoals de tabel op de site. */
function standTabel(h: H, rijen: Rij[]) {
  return h(
    'table',
    { className: 'standen-tabel' },
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, '#'), h('th', { scope: 'col' }, 'Speler'), h('th', { scope: 'col' }, 'Club'), h('th', { scope: 'col' }, 'Punten'))),
    h(
      'tbody',
      null,
      ...rijen.map((r, i) => h('tr', { key: i }, h('td', null, r.pos), h('td', null, r.naam), h('td', null, r.club ?? ''), h('td', null, toonPunten(r.punten)))),
    ),
  );
}

/**
 * De tien reeksen onder elkaar. Een reeks met een stand toont het aantal spelers en wie op kop staat: genoeg om te
 * vergelijken met Excel. Een klik klapt de volledige stand open. `bezig`: de pdf wordt nog gelezen.
 */
function reeksLijst(h: H, lijst: Reeks[], bezig: boolean) {
  return h(
    'ul',
    { className: 'standen-lijst', 'aria-busy': bezig },
    ...lijst.map((r) => {
      const naam = h('span', { className: 'standen-reeks' }, r.titel, r.geplakt && h('span', { className: 'standen-label' }, 'geplakt'), r.opmerking && h('span', { className: 'standen-label standen-label--let-op' }, 'kijk na'));
      if (!r.rijen.length)
        return h(
          'li',
          { key: r.sleutel },
          h(
            'div',
            { className: 'standen-rij standen-rij--geen' },
            naam,
            bezig ? h('span', { className: 'standen-balk', style: { width: 72 } }) : h('span', { className: 'standen-aantal' }, 'Geen stand'),
            bezig ? h('span', { className: 'standen-balk', style: { width: 160 } }) : h('span', { className: 'standen-kop' }, r.opmerking ?? ''),
          ),
        );
      const eerste = r.rijen[0];
      return h(
        'li',
        { key: r.sleutel },
        h(
          'details',
          null,
          h(
            'summary',
            { className: 'standen-rij' },
            naam,
            h('span', { className: 'standen-aantal' }, spelers(r.rijen.length)),
            h('span', { className: 'standen-kop' }, `${eerste.pos}. ${eerste.naam} · ${toonPunten(eerste.punten)} ${eerste.punten === 1 ? 'punt' : 'punten'}`),
          ),
          h('div', { className: 'standen-detail' }, r.opmerking && h('p', { className: 'standen-opmerking' }, r.opmerking), standTabel(h, r.rijen)),
        ),
      );
    }),
  );
}

/** Wat het voorbeeld van de pdf weet: nog aan het lezen, gelezen of niet te lezen. */
type Gelezen = { status: 'bezig' } | { status: 'klaar'; pdf: PdfStanden } | { status: 'fout' };

const PLAKKEN = 'klap links "Standen plakken" open en plak ze uit Excel';

/** De standen van één toernooi: bovenaan wat de site gevonden heeft en wat de user nu doet, daaronder de tien reeksen. */
function standenInhoud(h: H, toernooi: string, geplakt: Record<string, string>, pdf: string, gelezen?: Gelezen) {
  const klaar = gelezen?.status === 'klaar' ? gelezen.pdf : undefined;
  // Een pdf waarvan nog niets geweten is, wordt zo meteen gelezen: geen foutmelding in de tussentijd.
  const bezig = !!pdf && (!gelezen || gelezen.status === 'bezig');
  const lijst = reeksen.map((r) => reeksVoor(r, geplakt[r.sleutel] ?? '', klaar?.standen[r.sleutel] ?? []));
  const gevonden = lijst.filter((r) => r.rijen.length);
  const zonder = lijst.filter((r) => !r.rijen.length).map((r) => r.titel);
  const uitPdf = Object.keys(klaar?.standen ?? {}).length;
  const pdfMislukt = !!pdf && !bezig && uitPdf === 0;
  // "Na Gentse BC" uit de pdf telt enkel als er ook standen in staan: een andere pdf heeft ook zinnen met "Na ...".
  const na = uitPdf > 0 ? klaar?.na : undefined;
  const geenPdf = pdf && !/\.pdf$/i.test(pdf);
  const nogKiezen = toernooi ? '' : ' Kies links nog het toernooi.';

  // Eerst wat de user moet nakijken of verbeteren, dan pas wat er gevonden is.
  const meldingen: unknown[] = [];
  if (pdfMislukt)
    meldingen.push(
      status(
        h,
        'let-op',
        geenPdf ? 'Dit bestand is geen pdf.' : 'De site vindt geen standen in deze pdf.',
        geenPdf
          ? 'Sla de rankings in Excel op als pdf (Bestand → Opslaan als → PDF) en kies links dat bestand.'
          : `Is het de pdf met de rankings uit Excel? Kies links een ander bestand. Lukt het niet, ${PLAKKEN}.${gevonden.length ? ' Nu komen enkel de geplakte standen online.' : ''}`,
      ),
    );
  if (na && toernooi && anderToernooi(na, toernooi))
    meldingen.push(status(h, 'let-op', `In de pdf staat "Na ${na}", maar je koos ${toernooiNaam(toernooi)}.`, 'Kies links het juiste toernooi of de juiste pdf.'));
  if (klaar?.problemen.length) meldingen.push(status(h, 'let-op', 'Niet alles in de pdf is herkend.', `${klaar.problemen.join(' ')} Kijk de standen na.`));
  const inOrde = meldingen.length === 0;

  if (bezig) meldingen.push(status(h, 'neutraal', 'De pdf wordt gelezen…'));
  else if (!gevonden.length && !pdf)
    meldingen.push(status(h, 'neutraal', 'Nog geen standen.', `Kies links ${toernooi ? '' : 'het toernooi en '}de pdf met de rankings. Hier zie je dan welke standen de site erin vindt.`));
  else if (gevonden.length && zonder.length)
    meldingen.push(
      status(
        h,
        'ok',
        `${gevonden.length} van de ${lijst.length} standen gevonden.`,
        `Geen stand voor ${opsomming(zonder)}. Speelde daar nog niemand, dan klopt dat: op de site verandert er voor die reeksen niets. Ontbreekt er een stand, ${PLAKKEN}.${nogKiezen}`,
      ),
    );
  else if (gevonden.length) {
    const publiceer = inOrde && toernooi ? ' Klopt alles? Klik linksboven op "Publiceer".' : nogKiezen;
    meldingen.push(status(h, 'ok', `${lijst.length} standen gevonden.`, `Kijk ze na: klik op een reeks voor de volledige stand.${publiceer}`));
  }

  return h(
    'div',
    { className: 'standen' },
    h('h2', null, toernooi ? `Standen na ${toernooiNaam(toernooi)}` : na ? `Standen na ${na}` : 'Nieuwe ranking'),
    ...meldingen,
    (bezig || gevonden.length > 0) && reeksLijst(h, lijst, bezig),
  );
}

interface Lezer {
  props: { bronnen: string[]; toon(gelezen?: Gelezen): unknown };
  state: { gelezen?: Gelezen };
  /** De pdf waarvoor `state.gelezen` geldt. */
  sleutel?: string;
  setState(s: { gelezen?: Gelezen }): void;
  lees(): void;
}

/**
 * Leest de pdf zodra er een gekozen is en tekent daarna opnieuw. Het voorbeeld van Decap is een functie zonder eigen
 * toestand; deze klasse (createClass van Decap) houdt bij wat er gelezen is.
 */
const PdfLezer = w.createClass?.({
  getInitialState: () => ({}),
  componentDidMount(this: Lezer) {
    this.lees();
  },
  componentDidUpdate(this: Lezer) {
    this.lees();
  },
  lees(this: Lezer) {
    const { bronnen } = this.props;
    const sleutel = bronnen[0];
    if (sleutel === this.sleutel) return;
    this.sleutel = sleutel;
    if (!sleutel) {
      this.setState({ gelezen: undefined });
      return;
    }
    const klaar = (gelezen: Gelezen) => {
      if (this.sleutel === sleutel) this.setState({ gelezen });
    };
    this.setState({ gelezen: { status: 'bezig' } });
    standenUitPdf(bronnen).then(
      (pdf) => klaar({ status: 'klaar', pdf }),
      () => klaar({ status: 'fout' }),
    );
  },
  render(this: Lezer) {
    return this.props.toon(this.state.gelezen);
  },
});

function StandenVoorbeeld({ entry }: { entry: Entry }) {
  const h = w.h!;
  const veld = (pad: string[]) => String(entry.getIn(['data', ...pad]) ?? '');
  const toernooi = veld(['toernooi']);
  const pdf = veld(['pdf']);
  const geplakt = Object.fromEntries(reeksen.map((r) => [r.sleutel, veld(['geplakt', r.sleutel])]));
  const toon = (gelezen?: Gelezen) => standenInhoud(h, toernooi, geplakt, pdf, gelezen);
  if (!PdfLezer) return toon();
  const media = (entry.get('mediaFiles') as { toJS(): MediaBestand[] } | undefined)?.toJS() ?? [];
  return h(PdfLezer, { bronnen: pdf ? pdfBronnen(pdf, media) : [], toon });
}

w.CMS?.registerPreviewStyle(stijl);
w.CMS?.registerPreviewTemplate('nieuws', NieuwsVoorbeeld);
w.CMS?.registerPreviewTemplate('rankings', StandenVoorbeeld);
