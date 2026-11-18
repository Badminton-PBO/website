/**
 * Houdt geplakte en gesleepte afbeeldingen tegen in de tekstvelden van Decap.
 * Decap uploadt ze niet: het bericht linkt dan naar een andere site, of het hele beeld komt als
 * data-URL in het .md-bestand. De knop + → Image zet het bestand wel in de uploadmap.
 * De tekst rond de afbeelding wordt wel geplakt.
 */
const UITLEG = 'Klik op + boven de tekst en kies "Image": dan komt de afbeelding mee op de site.';

let melding: HTMLElement | undefined;
let timer: number | undefined;

function toon(tekst: string) {
  if (!melding) {
    melding = document.createElement('div');
    melding.setAttribute('role', 'status');
    melding.title = 'Klik om te sluiten';
    Object.assign(melding.style, {
      position: 'fixed',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      zIndex: '100000',
      boxSizing: 'border-box',
      width: 'max-content',
      maxWidth: 'min(560px, calc(100vw - 32px))',
      padding: '14px 20px',
      borderRadius: '16px',
      background: '#0C2A20',
      color: '#FFFFFF',
      font: '500 15px/1.45 system-ui, sans-serif',
      boxShadow: '0 8px 24px rgba(12, 42, 32, .3)',
      cursor: 'pointer',
    });
    melding.addEventListener('click', () => (melding!.hidden = true));
    document.body.append(melding);
  }
  melding.textContent = tekst;
  melding.hidden = false;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => (melding!.hidden = true), 10000);
}

/** De html zonder afbeeldingen, of null als er geen in zat. */
function zonderAfbeeldingen(html: string): { html: string; heeftTekst: boolean } | null {
  if (!/<(img|picture)\b/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('picture, img').forEach((el) => el.remove());
  return { html: doc.body.innerHTML, heeftTekst: (doc.body.textContent ?? '').trim() !== '' };
}

function onderschep(e: ClipboardEvent | DragEvent) {
  const editor = (e.target as Element | null)?.closest?.('[data-slate-editor]');
  const data = e instanceof DragEvent ? e.dataTransfer : e.clipboardData;
  if (!editor || !data) return;
  // Knippen en plakken binnen de editor zelf: laten doorgaan.
  if (data.types.includes('application/x-slate-fragment')) return;

  const html = data.getData('text/html');
  if (!html) {
    // Enkel een bestand (bv. een schermknipsel): Decap doet daar niets mee, dus zeg waarom.
    const enkelBeeld = !data.getData('text/plain') && [...data.files].some((f) => f.type.startsWith('image/'));
    if (enkelBeeld) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toon(`Een afbeelding plakken kan hier niet. ${UITLEG}`);
    }
    return;
  }

  const schoon = zonderAfbeeldingen(html);
  if (!schoon) return;
  e.preventDefault();
  e.stopImmediatePropagation();

  let tekstGeplakt = false;
  if (schoon.heeftTekst && e.type === 'paste') {
    const dt = new DataTransfer();
    for (const type of data.types) {
      if (type !== 'Files' && type !== 'text/html') dt.setData(type, data.getData(type));
    }
    dt.setData('text/html', schoon.html);
    // De editor verwerkt plakken via beforeinput en annuleert het event als dat gelukt is.
    tekstGeplakt = !editor.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertFromPaste', dataTransfer: dt, bubbles: true, cancelable: true }),
    );
  }
  toon(
    tekstGeplakt
      ? `De tekst is geplakt, de afbeelding niet. ${UITLEG}`
      : `Een afbeelding ${e.type === 'drop' ? 'hierheen slepen kan niet' : 'plakken kan hier niet'}. ${UITLEG}`,
  );
}

window.addEventListener('paste', onderschep, true);
window.addEventListener('drop', onderschep, true);
