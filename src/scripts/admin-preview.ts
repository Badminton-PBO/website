/**
 * Voorbeeld rechts in Decap, in de stijl van de site (src/styles/admin-preview.css).
 * - Nieuws: het bericht zoals op /nieuws/<slug>.
 * - Jeugdcup-ranking: de geplakte standen van één toernooi zoals de site ze leest, met dezelfde parser als de site
 *   (src/lib/stand.ts). Zo zie je meteen of het plakken gelukt is en welke reeksen nog leeg zijn.
 */
import stijl from '../styles/admin-preview.css?url';
import { leesStand, toonPunten } from '../lib/stand';
import { categorieen, geslachten } from '../lib/jeugdcup-labels';
import { categorieNaam } from '../lib/nieuws-labels';
import { lang } from '../lib/datum';
import { metBasispad } from './admin-basispad';
import { toernooiNaam } from './admin-toernooien';

type H = (tag: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => unknown;
interface Entry {
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

const kleur = { ink: '#0C2A20', muted: '#4A5852', wash: '#ECEEE6', brand: '#005E44', zacht: '#DCF7C8' };

const geel = '#FFF4D6';
const cel = { padding: '10px 12px', borderTop: `1px solid ${kleur.wash}`, verticalAlign: 'top' };

/** Eén geplakte stand: hoeveel rijen de site herkent, wat ze oversloeg en de tabel zelf. */
function standTabel(h: H, titel: string, tekst: string) {
  const rijen = leesStand(tekst);
  const overgeslagen = tekst.split(/\r?\n/).filter((r) => r.trim()).length - rijen.length;
  return h(
    'section',
    { key: titel, style: { marginTop: 32 } },
    h('h3', { style: { margin: '0 0 4px', fontSize: 20, fontWeight: 800 } }, titel),
    h(
      'p',
      { style: { margin: '0 0 12px', fontWeight: 600, color: kleur.brand } },
      rijen.length === 0 ? 'Geen rijen herkend.' : `${rijen.length} ${rijen.length === 1 ? 'rij' : 'rijen'} herkend.`,
    ),
    overgeslagen > 0 &&
      h(
        'p',
        { style: { margin: '0 0 12px', background: geel, padding: 12, borderRadius: 12 } },
        rijen.length === 0
          ? 'De site vindt geen punten in de laatste kolom. Plak de kolommen positie, naam, club en punten uit Excel.'
          : `${overgeslagen} ${overgeslagen === 1 ? 'regel' : 'regels'} overgeslagen: geen punten in de laatste kolom (bv. de kopregel). Klopt dat?`,
      ),
    rijen.length > 0 &&
      h(
        'table',
        { style: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' } },
        h(
          'thead',
          null,
          h('tr', { style: { color: kleur.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em' } },
            h('th', { style: { padding: '8px 12px' } }, '#'),
            h('th', { style: { padding: '8px 12px' } }, 'Speler'),
            h('th', { style: { padding: '8px 12px' } }, 'Club'),
            h('th', { style: { padding: '8px 12px', textAlign: 'right' } }, 'Punten'),
          ),
        ),
        h(
          'tbody',
          null,
          ...rijen.map((r, i) =>
            h('tr', { key: i },
              h('td', { style: { ...cel, fontWeight: 800 } }, r.pos),
              h('td', { style: { ...cel, fontWeight: 600 } }, r.naam),
              h('td', { style: { ...cel, color: kleur.muted } }, r.club ?? ''),
              h('td', { style: { ...cel, textAlign: 'right', fontWeight: 600 } }, toonPunten(r.punten)),
            ),
          ),
        ),
      ),
  );
}

/** Alle standen van één toernooi onder elkaar, met bovenaan welke reeksen nog leeg zijn. */
function StandenVoorbeeld({ entry }: { entry: Entry }) {
  const h = w.h!;
  const toernooi = String(entry.getIn(['data', 'toernooi']) ?? '');
  const reeksen = categorieen.flatMap((c) =>
    geslachten.map((g) => ({
      titel: `${c.label} ${g.label.toLowerCase()}`,
      tekst: String(entry.getIn(['data', c.id, g.id]) ?? ''),
    })),
  );
  const ingevuld = reeksen.filter((r) => r.tekst.trim());
  const leeg = reeksen.filter((r) => !r.tekst.trim());

  return h(
    'div',
    { style: { color: kleur.ink, padding: 24 } },
    h('h2', { style: { margin: '0 0 4px', fontSize: 24, fontWeight: 800 } }, toernooi ? `Standen na ${toernooiNaam(toernooi)}` : 'Kies eerst een toernooi.'),
    h(
      'p',
      { style: { margin: 0, padding: 16, borderRadius: 12, background: leeg.length ? kleur.zacht : 'transparent', paddingLeft: leeg.length ? 16 : 0 } },
      h('strong', null, `${ingevuld.length} van de ${reeksen.length} standen ingevuld.`),
      leeg.length > 0 && ` Nog leeg: ${leeg.map((r) => r.titel).join(', ')}.`,
    ),
    ...ingevuld.map((r) => standTabel(h, r.titel, r.tekst)),
  );
}

w.CMS?.registerPreviewStyle(stijl);
w.CMS?.registerPreviewTemplate('nieuws', NieuwsVoorbeeld);
w.CMS?.registerPreviewTemplate('rankings', StandenVoorbeeld);
