/**
 * Afbeeldingen uit public/ (bv. /wp-content/uploads/...) in Decap onder een basispad.
 * Op de testversie draait de site onder /website; Decap toont het pad uit het bericht zoals het
 * er staat, en dan vindt de browser het bestand niet. Dit zet het basispad ervoor, enkel in het
 * beeld: het bericht zelf blijft ongewijzigd. Op badminton-pbo.be (basispad /) doet dit niets.
 */
import { u } from '../lib/url';

const basis = u('/');

/** Zet het basispad voor elke afbeelding in `wortel` die met / begint. */
export function metBasispad(wortel: ParentNode | null | undefined) {
  if (basis === '/' || !wortel) return;
  wortel.querySelectorAll<HTMLImageElement>('img[src^="/"]').forEach((img) => {
    const src = img.getAttribute('src')!;
    if (!src.startsWith('//') && !src.startsWith(basis)) img.setAttribute('src', u(src));
  });
}

// De editor links: afbeeldingen komen en gaan terwijl je typt.
if (basis !== '/') {
  new MutationObserver(() => metBasispad(document.body)).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}
