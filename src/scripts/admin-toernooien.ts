/**
 * Een stand verwijst naar haar halte met een id (2026-09-26-bc-de-mintons), en Decap toont dat id in de lijst met
 * rankings: "Standen na 2026-09-26-bc-de-mintons". Dit script zet er de naam van de halte voor in de plaats:
 * "Standen na BC De Mintons, 26 september 2026". Het bestand zelf verandert niet.
 * De namen komen bij de build uit de kalender (src/components/DecapAdmin.astro); een halte die er nog niet bij is,
 * houdt haar id tot de volgende build.
 */
const namen = (window as unknown as { pboToernooien?: Record<string, string> }).pboToernooien ?? {};

/** "BC De Mintons, 26 september 2026", of het id als de halte niet (meer) in de kalender staat. */
export const toernooiNaam = (id: string) => namen[id] ?? id;

const PATROON = /Standen na (\d{4}-\d{2}-\d{2}-[a-z0-9-]+)/g;

function vervang(tekst: Node) {
  const waarde = tekst.nodeValue ?? '';
  if (!waarde.includes('Standen na ')) return;
  // Niet in een invoerveld: daar hoort te staan wat in het bestand komt.
  if (tekst.parentElement?.closest('textarea, input, [contenteditable="true"]')) return;
  const nieuw = waarde.replace(PATROON, (alles, id: string) => (namen[id] ? `Standen na ${namen[id]}` : alles));
  if (nieuw !== waarde) tekst.nodeValue = nieuw;
}

function doorloop(knoop: Node) {
  if (knoop.nodeType === Node.TEXT_NODE) return vervang(knoop);
  const teksten = document.createTreeWalker(knoop, NodeFilter.SHOW_TEXT);
  for (let t = teksten.nextNode(); t; t = teksten.nextNode()) vervang(t);
}

if (Object.keys(namen).length) {
  new MutationObserver((wijzigingen) => {
    for (const w of wijzigingen) {
      if (w.type === 'characterData') vervang(w.target);
      w.addedNodes.forEach(doorloop);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
