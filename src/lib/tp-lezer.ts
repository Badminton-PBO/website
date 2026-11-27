/**
 * Leest een TP-bestand: het bestand van Tournament Planner waarin een halte van de jeugdcuptour gespeeld is.
 * Het is een Access-database (Jet 4). mdb-reader leest ze in de browser: het bestand verlaat de computer niet.
 *
 * De tabellen en hun codes komen uit de vroegere Java-versie (github.com/Badminton-PBO/pbo-jeugdcupranking,
 * TpRepositoryImpl.java). Getest op TP-bestanden van 2019, 2020 en 2026.
 *
 * mdb-reader verwacht een globale `Buffer`: wie dit bestand in de browser laadt, zet die eerst
 * (src/scripts/admin-punten.ts).
 */
import MDBReader from 'mdb-reader';

/** M, F (meisjes) of X (onbekend): de codes die de Excel van de jeugdcup verwacht. */
export type Geslacht = 'M' | 'F' | 'X';
export type SoortSchema = 'afvalschema' | 'poule' | 'kwalificatieschema';
export type SoortOnderdeel = 'enkel' | 'dubbel' | 'gemengd';

export interface TpSpeler {
  id: number;
  voornaam: string;
  naam: string;
  lidnummer: string | null;
  geslacht: Geslacht;
  club: string;
}

/** Een onderdeel ("event" in TP): bv. "JE U13 A". */
export interface TpOnderdeel {
  id: number;
  naam: string;
  geslacht: Geslacht;
  soort: SoortOnderdeel;
}

/** Een schema ("draw" in TP): een poule of een afvalschema binnen een onderdeel. */
export interface TpSchema {
  id: number;
  naam: string;
  onderdeel: TpOnderdeel | null;
  soort: SoortSchema;
  grootte: number;
}

/** Een inschrijving: één speler, of twee in het dubbel. */
export interface TpTeam {
  id: number;
  speler1: TpSpeler | null;
  speler2: TpSpeler | null;
  /** Onderdelen waarin dit team in een schema staat. */
  onderdelen: TpOnderdeel[];
}

export interface TpMatch {
  id: number;
  schema: TpSchema | null;
  /** null bij een bye: het team had geen tegenstander. */
  team1: TpTeam | null;
  team2: TpTeam | null;
  winnaar: TpTeam | null;
  /** Altijd drie plaatsen, bv. ["21-12", "21-8", null]; een niet-gespeelde set is null. */
  sets: (string | null)[];
  walkOver: boolean;
  opgave: boolean;
  speelmoment: Date | null;
}

export interface TpToernooi {
  naam: string | null;
  /** Speeldag als JJJJ-MM-DD. */
  datum: string | null;
  spelers: TpSpeler[];
  onderdelen: TpOnderdeel[];
  schemas: TpSchema[];
  teams: TpTeam[];
  matchen: TpMatch[];
}

const GESLACHT_SPELER: Record<number, Geslacht> = { 1: 'M', 2: 'F' };
const GESLACHT_ONDERDEEL: Record<number, Geslacht> = { 4: 'M', 5: 'F' };
const SOORT_ONDERDEEL: Record<number, SoortOnderdeel> = { 1: 'enkel', 2: 'dubbel', 3: 'gemengd' };
const SOORT_SCHEMA: Record<number, SoortSchema> = { 1: 'afvalschema', 2: 'poule', 6: 'kwalificatieschema' };

/** Scorestatus van een match in TP. */
const WALK_OVER = 1;
const OPGAVE = 2;

function rijen<T>(lezer: MDBReader, tabel: string, kolommen: string[]): T[] {
  return lezer.getTable(tabel).getData({ columns: kolommen }) as unknown as T[];
}

function opId<T extends { id: number }>(lijst: T[]) {
  return new Map(lijst.map((item) => [item.id, item]));
}

function code<T>(codes: Record<number, T>, waarde: number, wat: string): T {
  const gevonden = codes[waarde];
  if (gevonden === undefined) throw new Error(`Onbekend ${wat} in het TP-bestand: ${waarde}.`);
  return gevonden;
}

/** Een set zonder punten is niet gespeeld. */
function set(thuis: number, uit: number) {
  return thuis > 0 || uit > 0 ? `${thuis}-${uit}` : null;
}

interface MatchRij {
  id: number;
  draw: number;
  planning: number;
  entry: number | null;
  winner: number;
  plandate: Date | null;
  van1: number | null;
  van2: number | null;
  team1set1: number;
  team2set1: number;
  team1set2: number;
  team2set2: number;
  team1set3: number;
  team2set3: number;
  scorestatus: number;
  reversehomeaway: boolean;
  roundnr: number;
}

export function leesToernooi(bestand: ArrayBuffer | Uint8Array): TpToernooi {
  const lezer = new MDBReader(Buffer.from(bestand as ArrayBuffer));

  const clubs = new Map(rijen<{ id: number; name: string }>(lezer, 'Club', ['id', 'name']).map((c) => [c.id, c.name]));

  // Een speler zonder club valt weg, zoals in de Java-versie (JOIN op Club).
  const spelers: TpSpeler[] = rijen<{ id: number; firstname: string; name: string; memberid: string | null; gender: number; club: number }>(
    lezer,
    'Player',
    ['id', 'firstname', 'name', 'memberid', 'gender', 'club'],
  )
    .filter((p) => clubs.has(p.club))
    .map((p) => ({
      id: p.id,
      voornaam: p.firstname,
      naam: p.name,
      lidnummer: p.memberid,
      geslacht: GESLACHT_SPELER[p.gender] ?? 'X',
      club: clubs.get(p.club)!,
    }));
  const spelerOpId = opId(spelers);

  const onderdelen: TpOnderdeel[] = rijen<{ id: number; name: string; gender: number; eventtype: number }>(lezer, 'Event', [
    'id',
    'name',
    'gender',
    'eventtype',
  ]).map((e) => ({
    id: e.id,
    naam: e.name,
    geslacht: GESLACHT_ONDERDEEL[e.gender] ?? 'X',
    soort: code(SOORT_ONDERDEEL, e.eventtype, 'soort onderdeel'),
  }));
  const onderdeelOpId = opId(onderdelen);

  const schemas: TpSchema[] = rijen<{ id: number; name: string; event: number; drawtype: number; drawsize: number }>(lezer, 'Draw', [
    'id',
    'name',
    'event',
    'drawtype',
    'drawsize',
  ]).map((d) => ({
    id: d.id,
    naam: d.name,
    onderdeel: onderdeelOpId.get(d.event) ?? null,
    soort: code(SOORT_SCHEMA, d.drawtype, 'soort schema'),
    grootte: d.drawsize,
  }));
  const schemaOpId = opId(schemas);

  const matchRijen = rijen<MatchRij>(lezer, 'PlayerMatch', [
    'id',
    'draw',
    'planning',
    'entry',
    'winner',
    'plandate',
    'van1',
    'van2',
    'team1set1',
    'team2set1',
    'team1set2',
    'team2set2',
    'team1set3',
    'team2set3',
    'scorestatus',
    'reversehomeaway',
    'roundnr',
  ]);

  // Teams: elke inschrijving die in minstens één schema staat.
  const inschrijvingOpId = opId(rijen<{ id: number; player1: number; player2: number }>(lezer, 'Entry', ['id', 'player1', 'player2']));
  const teamOpId = new Map<number, TpTeam>();
  for (const rij of matchRijen) {
    const inschrijving = rij.entry == null ? undefined : inschrijvingOpId.get(rij.entry);
    const schema = schemaOpId.get(rij.draw);
    if (!inschrijving || !schema) continue;
    let team = teamOpId.get(inschrijving.id);
    if (!team) {
      team = {
        id: inschrijving.id,
        speler1: spelerOpId.get(inschrijving.player1) ?? null,
        speler2: spelerOpId.get(inschrijving.player2) ?? null,
        onderdelen: [],
      };
      teamOpId.set(team.id, team);
    }
    if (schema.onderdeel && !team.onderdelen.includes(schema.onderdeel)) team.onderdelen.push(schema.onderdeel);
  }

  // Een rij in PlayerMatch is ofwel een plaats in het schema (met een inschrijving), ofwel een match die via
  // van1 en van2 naar het planningsnummer van twee andere rijen in hetzelfde schema wijst.
  const opPlaats = new Map<string, MatchRij[]>();
  for (const rij of matchRijen) {
    const sleutel = `${rij.draw}|${rij.planning}`;
    const lijst = opPlaats.get(sleutel);
    if (lijst) lijst.push(rij);
    else opPlaats.set(sleutel, [rij]);
  }
  const teamVan = (rij: MatchRij) => (rij.entry == null ? null : (teamOpId.get(rij.entry) ?? null));

  const matchen: TpMatch[] = [];
  for (const m of matchRijen) {
    // Enkel gespeelde matchen (er is een winnaar); een poulematch staat twee keer in TP, één keer omgekeerd.
    if (m.reversehomeaway || m.roundnr < 0 || !(m.winner > 0)) continue;
    if (m.van1 == null || m.van2 == null) continue;
    for (const thuis of opPlaats.get(`${m.draw}|${m.van1}`) ?? []) {
      for (const uit of opPlaats.get(`${m.draw}|${m.van2}`) ?? []) {
        const team1 = teamVan(thuis);
        const team2 = teamVan(uit);
        matchen.push({
          id: m.id,
          schema: schemaOpId.get(m.draw) ?? null,
          team1,
          team2,
          winnaar: m.winner === 1 ? team1 : m.winner === 2 ? team2 : null,
          sets: [set(m.team1set1, m.team2set1), set(m.team1set2, m.team2set2), set(m.team1set3, m.team2set3)],
          walkOver: m.scorestatus === WALK_OVER,
          opgave: m.scorestatus === OPGAVE,
          speelmoment: m.plandate,
        });
      }
    }
  }
  matchen.sort((a, b) => (a.speelmoment?.getTime() ?? 0) - (b.speelmoment?.getTime() ?? 0));

  const instellingen = new Map(rijen<{ name: string; value: string | null }>(lezer, 'Settings', ['name', 'value']).map((s) => [s.name, s.value]));
  const dag = rijen<{ id: number; tournamentday: Date | null }>(lezer, 'TournamentDay', ['id', 'tournamentday']).find((d) => d.id === 1);

  return {
    naam: instellingen.get('Tournament') ?? null,
    // Access bewaart de dag zonder tijdzone; mdb-reader geeft ze terug als middernacht UTC.
    datum: dag?.tournamentday ? dag.tournamentday.toISOString().slice(0, 10) : null,
    spelers,
    onderdelen,
    schemas,
    teams: [...teamOpId.values()],
    matchen,
  };
}
