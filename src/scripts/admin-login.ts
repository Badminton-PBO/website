/**
 * Is er een login van het beheer (Decap) met rechten op de repo? Voor pagina's onder /admin die niet in Decap
 * draaien, zoals /admin/jeugdcup/punten.
 *
 * Decap bewaart de login in localStorage (`decap-cms-user`, met het GitHub-token) en laat enkel accounts binnen die
 * naar de repo mogen pushen. Dit kijkt hetzelfde na. Het is een slot in de browser: de pagina en deze code zijn
 * publiek, dus er mag achter zo'n slot niets geheims staan.
 */
import { repo } from '../lib/repo';

export type Login =
  | { status: 'ok'; naam?: string }
  | { status: 'uit' }
  | { status: 'verlopen' }
  | { status: 'geen-rechten'; naam: string }
  | { status: 'fout' };

const SLEUTEL = 'decap-cms-user';

interface DecapUser {
  backendName?: string;
  token?: string;
  login?: string;
  name?: string;
}

function bewaard(): DecapUser | undefined {
  try {
    return JSON.parse(localStorage.getItem(SLEUTEL) ?? 'null') ?? undefined;
  } catch {
    return undefined;
  }
}

export async function login(): Promise<Login> {
  const user = bewaard();
  // Lokaal (npm run dev met npx decap-server) logt Decap in zonder GitHub, en enkel op deze adressen.
  if (user?.backendName === 'proxy' && ['localhost', '127.0.0.1'].includes(location.hostname)) return { status: 'ok' };
  if (user?.backendName !== 'github' || typeof user.token !== 'string') return { status: 'uit' };
  const naam = user.name || user.login || 'onbekend';
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${user.token}` },
      cache: 'no-store',
    });
    if (r.status === 401) return { status: 'verlopen' };
    if (!r.ok) return { status: 'fout' };
    const data = (await r.json()) as { permissions?: { push?: boolean } };
    return data.permissions?.push ? { status: 'ok', naam } : { status: 'geen-rechten', naam };
  } catch {
    return { status: 'fout' };
  }
}

/** Roept `terug` aan als er in een ander tabblad in- of uitgelogd wordt. */
export function bijWijziging(terug: () => void) {
  window.addEventListener('storage', (e) => {
    if (e.key === SLEUTEL || e.key === null) terug();
  });
}
