/**
 * Voorbeeld rechts in Decap, in de stijl van de site (src/styles/admin-preview.css).
 * - Nieuws: het bericht zoals op /nieuws/<slug>.
 * - Jeugdcup-stand: de geplakte stand zoals de site ze leest, met dezelfde parser als de site
 *   (src/lib/stand.ts). Zo zie je meteen of het plakken gelukt is.
 */
import stijl from '../styles/admin-preview.css?url';
import { leesStand, toonPunten } from '../lib/stand';
import { categorieLabel, geslachtLabel } from '../lib/jeugdcup-labels';
import { categorieNaam } from '../lib/nieuws-labels';
import { lang } from '../lib/datum';
import { u } from '../lib/url';

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
  el?.querySelectorAll<HTMLImageElement>('img[src^="/"]:not([data-basis])').forEach((img) => {
    img.dataset.basis = '';
    img.src = u(img.getAttribute('src')!);
  });
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

function StandVoorbeeld({ entry }: { entry: Entry }) {
  const h = w.h!;
  const tekst = String(entry.getIn(['data', 'stand']) ?? '');
  const rijen = leesStand(tekst);
  const regels = tekst.split(/\r?\n/).filter((r) => r.trim()).length;
  const overgeslagen = regels - rijen.length;
  const cat = categorieLabel(String(entry.getIn(['data', 'categorie']) ?? ''));
  const geslacht = geslachtLabel(String(entry.getIn(['data', 'geslacht']) ?? ''));
  const toernooi = String(entry.getIn(['data', 'toernooi']) ?? '');

  const cel = { padding: '10px 12px', borderTop: `1px solid ${kleur.wash}`, verticalAlign: 'top' };
  return h(
    'div',
    { style: { color: kleur.ink, padding: 24 } },
    h('h2', { style: { margin: '0 0 4px', fontSize: 24, fontWeight: 800 } }, `${cat || 'Categorie?'} · ${geslacht || 'jongens of meisjes?'}`),
    h('p', { style: { margin: '0 0 16px', color: kleur.muted } }, toernooi ? `Stand na ${toernooi}` : 'Kies eerst een toernooi.'),
    rijen.length === 0
      ? h('p', { style: { background: kleur.zacht, padding: 16, borderRadius: 12 } }, 'Nog geen stand. Plak de kolommen positie, naam, club en punten uit Excel.')
      : h(
          'div',
          null,
          h('p', { style: { margin: '0 0 12px', fontWeight: 600, color: kleur.brand } }, `${rijen.length} ${rijen.length === 1 ? 'rij' : 'rijen'} herkend.`),
          overgeslagen > 0 &&
            h(
              'p',
              { style: { margin: '0 0 12px', background: '#FFF4D6', padding: 12, borderRadius: 12 } },
              `${overgeslagen} ${overgeslagen === 1 ? 'regel' : 'regels'} overgeslagen: geen punten in de laatste kolom (bv. de kopregel). Klopt dat?`,
            ),
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
        ),
  );
}

w.CMS?.registerPreviewStyle(stijl);
w.CMS?.registerPreviewTemplate('nieuws', NieuwsVoorbeeld);
w.CMS?.registerPreviewTemplate('rankings', StandVoorbeeld);
