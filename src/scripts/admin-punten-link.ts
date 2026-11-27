/**
 * Link in het beheer naar /admin/jeugdcup/punten (punten van een halte berekenen uit het TP-bestand).
 * Decap 3.16 kent geen eigen links in het menu: de link staat linksonder, boven het blokje met de laatste publicatie
 * (admin-status.ts), in dezelfde vorm. Pas na het inloggen, en niet in een geopend item: daar staat hij voor het formulier.
 */
import { u } from '../lib/url';

const link = document.createElement('a');
link.href = u('/admin/jeugdcup/punten/');
link.target = '_blank';
link.rel = 'noopener';
link.textContent = 'Punten berekenen uit een TP-bestand';
Object.assign(link.style, {
  position: 'fixed',
  left: '16px',
  bottom: '68px',
  // Onder het paneel van admin-status.ts (99999), dat erover open klapt.
  zIndex: '99998',
  alignItems: 'center',
  minHeight: '40px',
  padding: '0 16px',
  borderRadius: '999px',
  border: '1px solid #D3D9CF',
  background: '#FFFFFF',
  color: '#005E44',
  font: '600 14px/1.45 system-ui, sans-serif',
  textDecoration: 'none',
  boxShadow: '0 6px 18px rgba(12, 42, 32, .18)',
} satisfies Partial<CSSStyleDeclaration>);

/** Niet op het loginscherm: Decap bewaart de login in localStorage (zie admin-login.ts). */
function ingelogd() {
  try {
    return !!localStorage.getItem('decap-cms-user');
  } catch {
    return false;
  }
}

/** Decap zet het scherm in de hash: #/collections/rankings is de lijst, .../entries/<id> en .../new een item. */
function toon() {
  link.style.display = ingelogd() && !/\/(entries|new)(\/|$|\?)/.test(location.hash) ? 'inline-flex' : 'none';
}

window.addEventListener('hashchange', toon);
// Na in- of uitloggen tekent Decap een ander scherm, ook als de hash niet verandert.
new MutationObserver(toon).observe(document.body, { childList: true, subtree: true });
toon();
document.body.append(link);
