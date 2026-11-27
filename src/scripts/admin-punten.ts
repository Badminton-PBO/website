/**
 * /admin/jeugdcup/punten: leest het TP-bestand van een halte en toont de punten per speler en de csv voor de Excel
 * van de ranking. Alles gebeurt in de browser; het bestand wordt nergens heen gestuurd.
 *
 * mdb-reader (met de lezer ruim 150 kB) laadt pas als er een bestand gekozen is, zoals pdf.js in admin-pdf.ts.
 */
// De schuine streep kiest het npm-pakket: `buffer` zonder streep is voor Vite de module van Node, en die is leeg in de browser.
import { Buffer } from 'buffer/';
import { berekenPunten, naarCsv, type Punten } from '../lib/jeugdcup-punten';
import { lang } from '../lib/datum';
import type { TpToernooi } from '../lib/tp-lezer';

// mdb-reader verwacht een globale Buffer, zoals in Node. Moet er staan voor tp-lezer laadt.
(globalThis as { Buffer?: unknown }).Buffer ??= Buffer;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const bestand = el<HTMLInputElement>('bestand');
const halte = el<HTMLInputElement>('halte');
const dubbel = el<HTMLInputElement>('dubbel');
const zoek = el<HTMLInputElement>('zoek');
const melding = el('melding');
const resultaat = el('resultaat');

let toernooi: TpToernooi | undefined;
/** De csv met de regeleinden die de Excel verwacht; een tekstvak zou ze omzetten. */
let csv = '';

function toonMelding(tekst: string, fout = false) {
  melding.textContent = tekst;
  melding.className = fout ? 'mt-6 font-semibold text-[#B42318]' : 'mt-6 text-muted';
}

/** Een rij uit een <template>, met per `data-veld` de tekst. */
function rij(sjabloon: string, velden: Record<string, string | number | null>) {
  const tr = el<HTMLTemplateElement>(sjabloon).content.firstElementChild!.cloneNode(true) as HTMLTableRowElement;
  for (const [naam, waarde] of Object.entries(velden)) {
    tr.querySelector(`[data-veld="${naam}"]`)!.textContent = waarde == null ? '' : String(waarde);
  }
  return tr;
}

function toonNakijken(punten: Punten) {
  const punten99 = punten.rijen.filter((r) => r.tijdelijkLidnummer);
  const zonderCategorie = punten.rijen.filter((r) => r.categorie === 'Unknown');
  const namen = (rijen: typeof punten.rijen) => rijen.map((r) => `${r.voornaam} ${r.naam}`).join(', ');
  const lijst = [
    ...(halte.value.trim() ? [] : ['Vul het volgnummer en de naam van de halte in: de kolom "tournament" in de csv is nu onvolledig.']),
    ...punten.waarschuwingen,
    ...(zonderCategorie.length
      ? [`Zonder leeftijdscategorie ("Unknown"), omdat de naam van het onderdeel er geen of meerdere noemt: ${namen(zonderCategorie)}. Vul ze aan in de Excel.`]
      : []),
    ...(punten99.length ? [`Zonder lidnummer in TP, met een tijdelijk nummer dat met 99 begint: ${namen(punten99)}. Zet in de Excel het juiste lidnummer.`] : []),
  ];
  el('nakijken-lijst').replaceChildren(
    ...lijst.map((tekst) => {
      const li = document.createElement('li');
      li.textContent = tekst;
      return li;
    }),
  );
  el('nakijken').hidden = lijst.length === 0;
}

let spelerRijen: { rij: HTMLTableRowElement; tekst: string }[] = [];

function filter() {
  const term = zoek.value.trim().toLowerCase();
  const zichtbaar = spelerRijen.filter((r) => r.tekst.includes(term));
  el('rijen').replaceChildren(...zichtbaar.map((r) => r.rij));
  el('aantal').textContent = term ? `${zichtbaar.length} van de ${spelerRijen.length} spelers` : `${spelerRijen.length} spelers`;
}

/** Rekent opnieuw met de opties van nu; het bestand hoeft niet opnieuw gelezen. */
function bereken() {
  if (!toernooi) return;
  let punten: Punten;
  try {
    punten = berekenPunten(toernooi, { altijdDubbeleSchemas: dubbel.checked });
  } catch (fout) {
    console.error(fout);
    resultaat.hidden = true;
    toonMelding(`De punten zijn niet te berekenen. ${fout instanceof Error ? fout.message : ''} Verwittig de webbeheerder.`, true);
    return;
  }
  csv = naarCsv(punten.rijen, halte.value.trim(), toernooi.datum);

  el('titel').textContent = toernooi.naam ?? 'Toernooi zonder naam';
  const metPunten = punten.onderdelen.filter((o) => !o.opmerking).length;
  el('samenvatting').textContent =
    `${toernooi.datum ? `Gespeeld op ${lang(toernooi.datum)}. ` : ''}` +
    `${punten.rijen.length} spelers met een resultaat, uit ${metPunten} van de ${punten.onderdelen.length} onderdelen.`;
  toonNakijken(punten);

  spelerRijen = punten.rijen.map((r) => ({
    rij: rij('rij-speler', {
      lidnummer: r.lidnummer,
      speler: `${r.voornaam} ${r.naam}`,
      club: r.club,
      categorie: `${r.categorie === 'Unknown' ? 'Onbekend' : r.categorie} ${r.geslacht === 'M' ? 'jongens' : r.geslacht === 'F' ? 'meisjes' : ''}`.trim(),
      punten: r.punten,
    }),
    tekst: `${r.lidnummer} ${r.voornaam} ${r.naam} ${r.club} ${r.categorie}`.toLowerCase(),
  }));
  filter();

  el('onderdelen').replaceChildren(
    ...punten.onderdelen.map((o) =>
      rij('rij-onderdeel', { naam: o.naam, categorie: o.categorie === 'Unknown' ? 'Onbekend' : o.categorie, reeks: o.reeks ?? '–', teams: o.teams, maximum: o.opmerking ? '–' : o.maximum, opmerking: o.opmerking }),
    ),
  );
  el('gekopieerd').textContent = '';
  resultaat.hidden = false;
}

bestand.addEventListener('change', async () => {
  const gekozen = bestand.files?.[0];
  if (!gekozen) return;
  toernooi = undefined;
  resultaat.hidden = true;
  toonMelding(`${gekozen.name} wordt gelezen …`);
  try {
    const { leesToernooi } = await import('../lib/tp-lezer');
    toernooi = leesToernooi(await gekozen.arrayBuffer());
  } catch (fout) {
    console.error(fout);
    toonMelding(`${gekozen.name} is niet te lezen. Kies het TP-bestand van de halte (het eindigt op .tp).`, true);
    return;
  }
  zoek.value = '';
  toonMelding(`${gekozen.name} gelezen.`);
  bereken();
});

halte.addEventListener('input', bereken);
dubbel.addEventListener('change', bereken);
zoek.addEventListener('input', filter);

el('kopieer').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(csv);
    el('gekopieerd').textContent = 'Gekopieerd. Plak ze nu in de Excel.';
  } catch {
    el('gekopieerd').textContent = 'Kopiëren lukt niet in deze browser. Download de csv.';
  }
});

el('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `punten-${(halte.value.trim() || toernooi?.datum || 'jeugdcup').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});
