/**
 * Staat in de bundel op de plaats van `browserify-aes` en `create-hash` (alias in astro.config.mjs).
 * mdb-reader gebruikt die pakketten enkel voor versleutelde Access-databases (Access 2007 en later). Een TP-bestand
 * is Jet 4 en niet versleuteld, en de echte pakketten vragen Node-modules (`stream`, `events`) die een browser niet heeft.
 */
function nietOndersteund(): never {
  throw new Error('Dit bestand is versleuteld en kan hier niet gelezen worden.');
}
nietOndersteund.createDecipheriv = nietOndersteund;

export default nietOndersteund;
