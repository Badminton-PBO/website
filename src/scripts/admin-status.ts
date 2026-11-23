/**
 * Zegt in het beheer of de laatste wijziging online staat. Elke wijziging in /admin is een commit; GitHub bouwt de
 * site dan opnieuw (.github/workflows/). Mislukt dat, dan blijft de vorige versie online en merkt niemand het.
 * Dit blokje linksonder toont de laatste publicatie: gelukt, bezig of mislukt, met de reden die de workflow
 * doorgeeft (scripts/build-fout.mjs).
 *
 * De repo is publiek, dus GitHub geeft de status zonder login. Is er een login van Decap, dan gaat dat token mee:
 * zonder mag je maar 60 keer per uur vragen (per IP-adres).
 * Lokaal (npm run dev) staat het uit; `/admin/?status` zet het aan om te testen.
 */
import { branch, repo } from '../lib/repo';

const API = `https://api.github.com/repos/${repo}`;
/** De testversie op GitHub Pages en de site op de hosting hebben elk hun workflow. */
const WORKFLOW = location.hostname.endsWith('.github.io') ? 'deploy.yml' : 'deploy-hosting.yml';
/** Titel van de annotatie met de reden; dezelfde als in scripts/build-fout.mjs. */
const TITEL_REDEN = 'Publiceren mislukt';
const TRAAG = 120_000;
const SNEL = 15_000;
/** Na het publiceren: zo lang wachten we op de nieuwe build voor we weer de vorige tonen. */
const WACHT_OP_BUILD = 180_000;

interface Run {
  id: number;
  status: string;
  conclusion: string | null;
  updated_at: string;
  html_url: string;
  display_title: string;
  head_commit?: { author?: { name?: string } };
}

type Soort = 'ok' | 'bezig' | 'fout';

const w = window as unknown as {
  CMS?: { registerEventListener(l: { name: string; handler(): void }): void };
};

// ------------------------------------------------------------------ GitHub

let zonderToken = false;

function token(): string | undefined {
  if (zonderToken) return undefined;
  try {
    const user = JSON.parse(localStorage.getItem('decap-cms-user') ?? 'null');
    return user?.backendName === 'github' && typeof user.token === 'string' ? user.token : undefined;
  } catch {
    return undefined;
  }
}

/** Antwoord van GitHub, of undefined als het niet lukt (geen verbinding, te veel aanvragen). */
async function gh<T>(pad: string): Promise<T | undefined> {
  const t = token();
  try {
    const r = await fetch(`${API}${pad}`, {
      headers: { Accept: 'application/vnd.github+json', ...(t && { Authorization: `Bearer ${t}` }) },
      cache: 'no-store',
    });
    // Verlopen login: de status is ook zonder leesbaar.
    if (r.status === 401 && t) {
      zonderToken = true;
      return gh(pad);
    }
    return r.ok ? ((await r.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** De laatste publicatie. null: er is er nog geen (bv. de hosting is nog niet ingesteld). */
async function laatsteRun(): Promise<Run | null | undefined> {
  const antwoord = await gh<{ workflow_runs: Run[] }>(`/actions/workflows/${WORKFLOW}/runs?branch=${branch}&per_page=5`);
  if (!antwoord) return undefined;
  // Een overgeslagen of afgebroken run zegt niets over de site: GitHub breekt een wachtende build af als er een nieuwe komt.
  return antwoord.workflow_runs.find((r) => r.status !== 'completed' || !['skipped', 'cancelled'].includes(r.conclusion ?? '')) ?? null;
}

const redenen = new Map<number, string | undefined>();

/** Waarom de build mislukte, als de workflow dat kon doorgeven. */
async function redenVan(run: Run): Promise<string | undefined> {
  if (redenen.has(run.id)) return redenen.get(run.id);
  const antwoord = await gh<{ jobs: { id: number; conclusion: string | null }[] }>(`/actions/runs/${run.id}/jobs?per_page=20`);
  if (!antwoord) return undefined;
  let reden: string | undefined;
  for (const job of antwoord.jobs.filter((j) => j.conclusion === 'failure')) {
    const annotaties = await gh<{ title: string; message: string }[]>(`/check-runs/${job.id}/annotations`);
    reden = annotaties?.find((a) => a.title === TITEL_REDEN)?.message;
    if (reden) break;
  }
  redenen.set(run.id, reden);
  return reden;
}

// ------------------------------------------------------------------ weergave

const kleur = { ink: '#0C2A20', muted: '#4A5852', line: '#D3D9CF', wash: '#ECEEE6', brand: '#005E44', oranje: '#B25E09', rood: '#B42318' };
const stip: Record<Soort, string> = { ok: kleur.brand, bezig: kleur.oranje, fout: '#FFFFFF' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, stijl: Partial<CSSStyleDeclaration> = {}, tekst?: string) {
  const e = document.createElement(tag);
  Object.assign(e.style, stijl);
  if (tekst !== undefined) e.textContent = tekst;
  return e;
}

const doos = el('div', {
  position: 'fixed',
  left: '16px',
  bottom: '16px',
  zIndex: '99999',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '8px',
  maxWidth: 'min(440px, calc(100vw - 32px))',
  font: '500 14px/1.45 system-ui, sans-serif',
  color: kleur.ink,
});
const paneel = el('div', {
  boxSizing: 'border-box',
  width: '100%',
  maxHeight: 'min(70vh, 520px)',
  overflowY: 'auto',
  padding: '16px 18px',
  borderRadius: '16px',
  border: `1px solid ${kleur.line}`,
  background: '#FFFFFF',
  boxShadow: '0 12px 32px rgba(12, 42, 32, .25)',
});
paneel.id = 'pbo-status-paneel';
const knop = el('button', {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '40px',
  padding: '0 16px',
  borderRadius: '999px',
  font: 'inherit',
  fontWeight: '600',
  cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(12, 42, 32, .18)',
});
knop.type = 'button';
knop.setAttribute('aria-controls', paneel.id);
const bol = el('span', { width: '10px', height: '10px', borderRadius: '50%', flexShrink: '0' });
const label = el('span');
label.setAttribute('role', 'status');
knop.append(bol, label);
doos.append(paneel, knop);
doos.hidden = true;

/** "vandaag om 12:23", "gisteren om 18:05", "17 november om 09:40". */
function wanneer(iso: string) {
  const d = new Date(iso);
  const dag = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(x);
  const uur = new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' }).format(d);
  const gisteren = new Date(Date.now() - 86_400_000);
  const welkeDag =
    dag(d) === dag(new Date())
      ? 'vandaag'
      : dag(d) === dag(gisteren)
        ? 'gisteren'
        : new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'long' }).format(d);
  return `${welkeDag} om ${uur}`;
}

const alinea = (tekst: string, stijl: Partial<CSSStyleDeclaration> = {}) => el('p', { margin: '0 0 10px', ...stijl }, tekst);

/** "Aangepast in kalender: 2026-2027" door Jan Peeters */
function wijziging(run: Run) {
  const door = run.head_commit?.author?.name;
  return `“${run.display_title}”${door ? ` door ${door}` : ''}`;
}

let open = false;
/** Soort en run van wat er nu staat: bij iets nieuws klapt het paneel dicht, of open als het mislukt is. */
let getoond = '';

function toon(soort: Soort, run: Run | undefined, reden?: string) {
  const sleutel = `${soort}:${run?.id ?? ''}`;
  if (sleutel !== getoond) open = soort === 'fout';
  getoond = sleutel;

  label.textContent =
    soort === 'fout' ? 'Publiceren mislukt' : soort === 'bezig' ? 'Bezig met publiceren …' : `Online sinds ${wanneer(run!.updated_at)}`;
  bol.style.background = stip[soort];
  Object.assign(knop.style, {
    background: soort === 'fout' ? kleur.rood : '#FFFFFF',
    color: soort === 'fout' ? '#FFFFFF' : kleur.ink,
    border: `1px solid ${soort === 'fout' ? kleur.rood : kleur.line}`,
  });

  paneel.replaceChildren();
  if (soort === 'fout' && run) {
    paneel.append(
      el('h2', { margin: '0 0 8px', font: '700 17px/1.3 system-ui, sans-serif', color: kleur.rood }, 'De laatste wijziging staat niet online'),
      alinea('De site toont nog de vorige versie. Tot dit opgelost is, komen ook nieuwe wijzigingen niet online.'),
      alinea(`Laatste wijziging: ${wijziging(run)}, ${wanneer(run.updated_at)}.`),
    );
    if (reden) {
      paneel.append(
        alinea('Wat er misliep:', { margin: '0 0 4px', fontWeight: '700' }),
        el('pre', { margin: '0 0 10px', padding: '10px 12px', borderRadius: '10px', background: kleur.wash, font: 'inherit', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, reden),
      );
    }
    paneel.append(alinea('Verbeter het in het beheer en publiceer opnieuw. Lukt dat niet, verwittig dan de webbeheerder.'));
    const link = el('a', { color: kleur.brand, fontWeight: '600' }, 'Technische details op GitHub');
    link.href = run.html_url;
    link.target = '_blank';
    link.rel = 'noopener';
    paneel.append(link);
  } else if (soort === 'bezig') {
    paneel.append(
      alinea(run ? `${wijziging(run)} wordt gepubliceerd.` : 'Je wijziging is bewaard.'),
      alinea('De site wordt opnieuw gebouwd. Dat duurt een paar minuten; je mag intussen verder werken.', { margin: '0', color: kleur.muted }),
    );
  } else if (run) {
    paneel.append(
      alinea(`Laatste wijziging: ${wijziging(run)}. Ze staat online.`),
      alinea('Zie je ze nog niet op de site? Wacht een paar minuten en herlaad de pagina.', { margin: '0', color: kleur.muted }),
    );
  }
  paneel.hidden = !open;
  knop.setAttribute('aria-expanded', String(open));
  doos.hidden = false;
}

knop.addEventListener('click', () => {
  open = !open;
  paneel.hidden = !open;
  knop.setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && open) knop.click();
});

// ------------------------------------------------------------------ opvolgen

let laatste: Run | undefined;
/** Net gepubliceerd: tot GitHub een nieuwere build toont dan `vorige`, is het "bezig". */
let gepubliceerd: { vorige: number; sinds: number } | undefined;
let timer: number | undefined;
/** Zolang er een build loopt, kijken we vaker. Lukt een aanvraag niet, dan blijft het tempo zoals het was. */
let snel = false;

async function kijk() {
  window.clearTimeout(timer);
  if (document.hidden) return;
  const run = await laatsteRun();
  if (run) {
    snel = false;
    laatste = run;
    if (gepubliceerd && (run.id !== gepubliceerd.vorige || Date.now() - gepubliceerd.sinds > WACHT_OP_BUILD)) gepubliceerd = undefined;
    if (gepubliceerd) {
      toon('bezig', undefined);
      snel = true;
    } else if (run.status !== 'completed') {
      toon('bezig', run);
      snel = true;
    } else if (run.conclusion === 'success') {
      toon('ok', run);
    } else {
      toon('fout', run, await redenVan(run));
    }
  } else if (run === null) {
    snel = !!gepubliceerd;
  }
  timer = window.setTimeout(kijk, snel ? SNEL : TRAAG);
}

function start() {
  document.body.append(doos);
  // Na het publiceren duurt het enkele seconden voor GitHub de nieuwe build toont.
  w.CMS?.registerEventListener({
    name: 'postSave',
    handler: () => {
      gepubliceerd = { vorige: laatste?.id ?? 0, sinds: Date.now() };
      toon('bezig', undefined);
      window.clearTimeout(timer);
      timer = window.setTimeout(kijk, 8000);
    },
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) kijk();
  });
  kijk();
}

const lokaal = ['localhost', '127.0.0.1'].includes(location.hostname);
if (!lokaal || new URLSearchParams(location.search).has('status')) start();
