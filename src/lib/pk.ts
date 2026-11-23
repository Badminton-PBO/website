import { getEntry, render } from 'astro:content';
import { plusDagen, weekdagDagMaand } from './datum';
import { routeUrl } from './toernooi';

/** Zo lang blijft het blok na de laatste speeldag op de home (met de knop "Uitslagen"), ook als niemand het uitzet. */
const DAGEN_NA_PK = 14;

/** Provinciaal kampioenschap uit src/content/pk/pk.md, met de zinnen en knoppen die de home en /pk delen. */
export async function pk() {
  const entry = await getEntry('pk', 'pk');
  if (!entry) throw new Error('src/content/pk/pk.md ontbreekt.');
  const { Content } = await render(entry);
  const d = entry.data;
  const wanneer = d.datumTot ? `${weekdagDagMaand(d.datum)} en ${weekdagDagMaand(d.datumTot)}` : weekdagDagMaand(d.datum);
  const door = d.organisatie ? `, georganiseerd door ${d.organisatie}` : '';
  const zin = `${wanneer.charAt(0).toUpperCase()}${wanneer.slice(1)} in ${d.plaats}${door}.`;
  // Voor ToernooiKnop: de knop volgt de laatste speeldag (inschrijven, dan wedstrijden, na het PK uitslagen).
  const toernooi = { datum: d.datumTot ?? d.datum, toernooilink: d.toernooilink, inschrijvenTot: d.inschrijvenTot };
  const route = routeUrl({ adres: d.adres, sporthal: d.sporthal, bij: d.plaats });
  // Laatste dag van het blok op de home (voor Periode): twee weken na het PK verdwijnt het vanzelf.
  const homeTot = plusDagen(toernooi.datum, DAGEN_NA_PK);
  return { ...d, Content, titel: `${d.naam} ${d.datum.slice(0, 4)}`, wanneer, zin, toernooi, route, homeTot };
}
