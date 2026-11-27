/**
 * Punten van één halte van de jeugdcuptour, berekend uit het TP-bestand (src/lib/tp-lezer.ts).
 * De jeugdverantwoordelijke zet ze als csv in de Excel van de ranking; de site zelf telt niets op.
 *
 * De regels komen uit de vroegere Java-versie (github.com/Badminton-PBO/pbo-jeugdcupranking, map core) en zijn
 * ongewijzigd overgenomen. Nagekeken met de verwachte waarden uit de Java-tests en met de ranking na BC Landegem 2026:
 * 110 van de 110 spelers gelijk.
 *
 * Per onderdeel: plaats 1 krijgt 100 punten (97 in een B-reeks), elke plaats lager 5 minder. Wie in meerdere
 * onderdelen speelt, houdt zijn beste resultaat (artikel 9.8).
 */
import type { TpMatch, TpOnderdeel, TpSchema, TpSpeler, TpTeam, TpToernooi } from './tp-lezer';

export interface Leeftijdscategorie {
  /** Zoals in de csv: Minibad, U11, U13, U15, U17-U19 of Unknown. */
  naam: string;
  /** Wie in onderdelen van meerdere categorieën speelt, krijgt die met de laagste volgorde. */
  volgorde: number;
}

const MINIBAD: Leeftijdscategorie = { naam: 'Minibad', volgorde: 0 };
const U11: Leeftijdscategorie = { naam: 'U11', volgorde: 1 };
const U13: Leeftijdscategorie = { naam: 'U13', volgorde: 2 };
const U15: Leeftijdscategorie = { naam: 'U15', volgorde: 3 };
const U17U19: Leeftijdscategorie = { naam: 'U17-U19', volgorde: 4 };
export const ONBEKEND: Leeftijdscategorie = { naam: 'Unknown', volgorde: 5 };
const CATEGORIE_OP_CODE: Record<string, Leeftijdscategorie> = { U11, U13, U15, U17: U17U19, U19: U17U19 };

/** De leeftijdscategorie uit de naam van een onderdeel: "JE U13 A" → U13, "JE U17+U19 B" → U17-U19. */
export function leeftijdscategorie(onderdeel: string | null | undefined): Leeftijdscategorie {
  if (onderdeel == null) return ONBEKEND;
  const naam = onderdeel.toUpperCase().trim().replace(/[-_\s]/g, '');
  const gevonden = new Set<Leeftijdscategorie>();
  if (naam.includes('MINI')) gevonden.add(MINIBAD);
  for (const [code] of naam.matchAll(/U\d\d/g)) gevonden.add(CATEGORIE_OP_CODE[code] ?? ONBEKEND);
  // Twee categorieën in één onderdeel (bv. "U11-U13"): niet te bepalen.
  return gevonden.size === 1 ? [...gevonden][0] : ONBEKEND;
}

/** De reeks uit het einde van de naam van een onderdeel: "JE U13 A" of "ME U15 B-reeks". */
export function reeks(onderdeel: string | null | undefined): 'A' | 'B' | null {
  if (onderdeel == null) return null;
  const gevonden = /([AB])([_\s]REEKS)?$/.exec(onderdeel.toUpperCase().trim().replace(/-/g, '_'));
  return gevonden ? (gevonden[1] as 'A' | 'B') : null;
}

// ------------------------------------------------------------------ model

interface Speler extends Omit<TpSpeler, 'lidnummer'> {
  lidnummer: string | null;
  categorie: Leeftijdscategorie;
  tijdelijkLidnummer: boolean;
}

interface Team {
  id: number;
  speler1: Speler | null;
  speler2: Speler | null;
  /** Aantal matchen zonder walk-over: een team moet er minstens één hebben om punten te krijgen. */
  gespeeld: number;
  gafOp: boolean;
}

interface Match {
  team1: Team | null;
  team2: Team | null;
  winnaar: Team | null;
  sets: (string | null)[];
  walkOver: boolean;
  opgave: boolean;
  /** Poulematch van een team dat opgaf: telt niet mee voor de stand in de poule. */
  teltNiet: boolean;
}

interface Schema {
  id: number;
  naam: string;
  soort: TpSchema['soort'];
  onderdeel: Onderdeel | null;
  matchen: Match[];
  /** Stand van de poule, één keer berekend. */
  stand?: Team[];
}

interface Onderdeel {
  naam: string;
  categorie: Leeftijdscategorie;
  reeks: 'A' | 'B' | null;
  poules: Schema[];
  afvalschemas: Schema[];
}

export interface PuntenRij {
  lidnummer: string;
  /** Speler zonder lidnummer in TP: een nummer dat met 99 begint, manueel op te volgen. */
  tijdelijkLidnummer: boolean;
  voornaam: string;
  naam: string;
  geslacht: TpSpeler['geslacht'];
  club: string;
  categorie: string;
  punten: number;
}

export interface OnderdeelResultaat {
  naam: string;
  categorie: string;
  reeks: 'A' | 'B' | null;
  teams: number;
  maximum: number;
  /** Waarom dit onderdeel geen punten geeft. */
  opmerking: string | null;
}

export interface Punten {
  rijen: PuntenRij[];
  onderdelen: OnderdeelResultaat[];
  /** Wat de jeugdverantwoordelijke zelf moet nakijken. */
  waarschuwingen: string[];
}

// ------------------------------------------------------------------ hulpjes

/**
 * De volgorde waarin een Java-HashMap met gehele sleutels itereert. De Java-versie hing daar op twee plaatsen van af:
 * welke speler welk tijdelijk lidnummer krijgt, en welk van twee gelijkwaardige afvalschema's eerst komt.
 */
function javaVolgorde<T>(items: T[], sleutel: (item: T) => number): T[] {
  let grootte = 16;
  while (items.length > grootte * 0.75) grootte *= 2;
  return items
    .map((item, index) => {
      const s = sleutel(item);
      return { item, index, vak: (s ^ (s >>> 16)) & (grootte - 1) };
    })
    .sort((a, b) => a.vak - b.vak || a.index - b.index)
    .map((x) => x.item);
}

function groepeer<T, S>(items: T[], sleutel: (item: T) => S): Map<S, T[]> {
  const groepen = new Map<S, T[]>();
  for (const item of items) {
    const s = sleutel(item);
    const groep = groepen.get(s);
    if (groep) groep.push(item);
    else groepen.set(s, [item]);
  }
  return groepen;
}

function gespeeldeSets(match: Match) {
  return match.sets
    .filter((s): s is string => s != null)
    .map((s) => {
      const [team1, team2] = s.split('-').map(Number);
      return { team1, team2 };
    });
}

function verliezer(match: Match) {
  return match.team1 && match.team1 === match.winnaar ? match.team2 : match.team1;
}

function teamsVan(schema: Schema): Team[] {
  return [...new Set(schema.matchen.flatMap((m) => [m.team1, m.team2]).filter((t): t is Team => t != null))];
}

function setSaldo(match: Match, team: Team) {
  let gewonnen1 = 0;
  let gewonnen2 = 0;
  for (const s of gespeeldeSets(match)) {
    if (s.team1 > s.team2) gewonnen1++;
    else gewonnen2++;
  }
  return team === match.team1 ? gewonnen1 - gewonnen2 : gewonnen2 - gewonnen1;
}

function puntenSaldo(match: Match, team: Team) {
  let saldo = 0;
  for (const s of gespeeldeSets(match)) saldo += s.team1 - s.team2;
  return team === match.team1 ? saldo : -saldo;
}

function naamVan(team: Team) {
  return [team.speler1, team.speler2]
    .filter((s): s is Speler => s != null)
    .map((s) => `${s.voornaam} ${s.naam}`)
    .join(' / ');
}

// ------------------------------------------------------------------ stand

/**
 * De stand in één poule. In volgorde: wie speelde (voor wie opgaf, voor wie enkel walk-overs had), aantal gewonnen
 * matchen, en bij gelijke stand het onderlinge duel (twee teams) of het saldo van sets en dan van punten (meer dan twee).
 */
function poulestand(poule: Schema, waarschuwingen: string[]): Team[] {
  if (poule.stand) return poule.stand;
  const teams = teamsVan(poule).sort((a, b) => a.id - b.id);
  const geteld = poule.matchen.filter((m) => !m.teltNiet);
  const som = (team: Team, saldo: (m: Match, t: Team) => number) =>
    geteld.filter((m) => m.team1 === team || m.team2 === team).reduce((totaal, m) => totaal + saldo(m, team), 0);

  const gespeeld = new Map(teams.map((t) => [t, t.gespeeld === 0 ? 0 : t.gafOp ? 1 : 2]));
  const gewonnen = new Map(teams.map((t) => [t, geteld.filter((m) => m.winnaar === t).length]));
  const sets = new Map(teams.map((t) => [t, som(t, setSaldo)]));
  const punten = new Map(teams.map((t) => [t, som(t, puntenSaldo)]));

  // De teams die met precies twee (of met meer dan twee) dezelfde waarde hebben.
  const gedeeld = (waarden: Map<Team, number>, aantal: (n: number) => boolean) =>
    new Set([...groepeer(teams, (t) => waarden.get(t)!).values()].filter((groep) => aantal(groep.length)).flat());
  const metTwee = (n: number) => n === 2;
  const metMeer = (n: number) => n > 2;

  const onderlingDuel = (binnen: Set<Team>) => (t1: Team, t2: Team) => {
    if (!binnen.has(t1) || !binnen.has(t2)) return 0;
    const duel = poule.matchen.find((m) => (m.team1 === t1 && m.team2 === t2) || (m.team1 === t2 && m.team2 === t1));
    if (!duel) throw new Error(`In poule "${poule.naam}" is er geen match tussen ${naamVan(t1)} en ${naamVan(t2)}.`);
    return duel.winnaar === t1 ? -1 : 1;
  };
  const hoogsteEerst = (waarden: Map<Team, number>, binnen?: Set<Team>) => (t1: Team, t2: Team) =>
    binnen && (!binnen.has(t1) || !binnen.has(t2)) ? 0 : waarden.get(t2)! - waarden.get(t1)!;

  const regels = [
    hoogsteEerst(gespeeld),
    hoogsteEerst(gewonnen),
    onderlingDuel(gedeeld(gewonnen, metTwee)),
    hoogsteEerst(sets, gedeeld(gewonnen, metMeer)),
    onderlingDuel(gedeeld(sets, metTwee)),
    hoogsteEerst(punten, gedeeld(sets, metMeer)),
    onderlingDuel(gedeeld(punten, metTwee)),
  ];
  const vergelijk = (t1: Team, t2: Team) => {
    for (const regel of regels) {
      const uitkomst = regel(t1, t2);
      if (uitkomst !== 0) return uitkomst;
    }
    return 0;
  };

  teams.sort(vergelijk);
  for (let i = 1; i < teams.length; i++) {
    if (vergelijk(teams[i - 1], teams[i]) === 0) {
      waarschuwingen.push(
        `Gelijke stand in poule "${poule.naam}" tussen ${naamVan(teams[i - 1])} en ${naamVan(teams[i])}: de volgorde is niet te bepalen. Kijk hun punten na.`,
      );
    }
  }
  poule.stand = teams;
  return teams;
}

/** De eindstand van een onderdeel: een lijst plaatsen, elk met één of meer teams. */
function eindstand(onderdeel: Onderdeel, waarschuwingen: string[]): Team[][] {
  const { poules, afvalschemas } = onderdeel;
  if (poules.length === 0) return [];
  if (afvalschemas.length === 0) {
    if (poules.length > 1) throw new Error(`Onderdeel "${onderdeel.naam}" heeft meer dan één poule maar geen afvalschema.`);
    return poulestand(poules[0], waarschuwingen).map((team) => [team]);
  }

  // Het afvalschema met de poulewinnaars eerst: de som van de plaatsen in de poule is daar het laagst.
  const gewicht = (schema: Schema) =>
    teamsVan(schema).reduce((totaal, team) => {
      const poule = poules.find((p) => teamsVan(p).includes(team));
      if (!poule) {
        throw new Error(`${naamVan(team)} staat in afvalschema "${schema.naam}" maar in geen enkele poule van "${onderdeel.naam}".`);
      }
      return totaal + poulestand(poule, waarschuwingen).indexOf(team);
    }, 0);
  const gewichten = new Map(afvalschemas.map((s) => [s, gewicht(s)]));
  const opVolgorde = [...afvalschemas].sort((a, b) => gewichten.get(a)! - gewichten.get(b)!);

  const stand: Team[][] = [];
  const inAfvalschema = new Set<Team>();
  for (const schema of opVolgorde) {
    const teams = teamsVan(schema);
    teams.forEach((t) => inAfvalschema.add(t));
    const opWinst = groepeer(teams, (t) => schema.matchen.filter((m) => m.winnaar === t).length);
    for (const winst of [...opWinst.keys()].sort((a, b) => b - a)) stand.push(opWinst.get(winst)!);
  }

  // Wie na de poule niet doorging naar een afvalschema: dezelfde plaats in de poule geeft dezelfde plaats.
  const rest = new Map<number, Team[]>();
  for (const poule of poules) {
    poulestand(poule, waarschuwingen).forEach((team, plaats) => {
      if (inAfvalschema.has(team)) return;
      const lijst = rest.get(plaats);
      if (lijst) lijst.push(team);
      else rest.set(plaats, [team]);
    });
  }
  for (const plaats of [...rest.keys()].sort((a, b) => a - b)) stand.push(rest.get(plaats)!);
  return stand;
}

// ------------------------------------------------------------------ punten

export interface PuntenOpties {
  /**
   * Eerste twee haltes van het kalenderjaar: er wordt altijd met dubbele schema's gespeeld, en een B-reeks start dan
   * ook op 100 punten in plaats van 97.
   */
  altijdDubbeleSchemas?: boolean;
}

export function berekenPunten(toernooi: TpToernooi, { altijdDubbeleSchemas = false }: PuntenOpties = {}): Punten {
  const waarschuwingen: string[] = [];

  const spelers = new Map<TpSpeler, Speler>(toernooi.spelers.map((s) => [s, { ...s, categorie: ONBEKEND, tijdelijkLidnummer: false }]));
  const onderdelen = new Map<TpOnderdeel, Onderdeel>(
    toernooi.onderdelen.map((o) => [o, { naam: o.naam, categorie: leeftijdscategorie(o.naam), reeks: reeks(o.naam), poules: [], afvalschemas: [] }]),
  );
  const speler = (bron: TpSpeler | null) => (bron ? (spelers.get(bron) ?? null) : null);
  const teams = new Map<TpTeam, Team>(
    toernooi.teams.map((t) => [t, { id: t.id, speler1: speler(t.speler1), speler2: speler(t.speler2), gespeeld: 0, gafOp: false }]),
  );
  const team = (bron: TpTeam | null) => (bron ? (teams.get(bron) ?? null) : null);

  // Een speler krijgt de laagste leeftijdscategorie van de onderdelen waarin hij speelt.
  for (const [bron, t] of teams) {
    for (const o of bron.onderdelen) {
      const categorie = onderdelen.get(o)!.categorie;
      for (const s of [t.speler1, t.speler2]) {
        if (s && categorie.volgorde < s.categorie.volgorde) s.categorie = categorie;
      }
    }
  }

  const schemas = new Map<TpSchema, Schema>();
  const schemaVan = (bron: TpSchema) => {
    let schema = schemas.get(bron);
    if (!schema) {
      schema = { id: bron.id, naam: bron.naam, soort: bron.soort, onderdeel: bron.onderdeel ? (onderdelen.get(bron.onderdeel) ?? null) : null, matchen: [] };
      schemas.set(bron, schema);
    }
    return schema;
  };

  for (const bron of toernooi.matchen as TpMatch[]) {
    if (!bron.schema) continue;
    const match: Match = {
      team1: team(bron.team1),
      team2: team(bron.team2),
      winnaar: team(bron.winnaar),
      sets: bron.sets,
      walkOver: bron.walkOver,
      opgave: bron.opgave,
      teltNiet: false,
    };
    for (const t of [match.team1, match.team2]) {
      if (!t) continue;
      if (!match.walkOver) t.gespeeld++;
      if (match.opgave && verliezer(match) === t) t.gafOp = true;
    }
    schemaVan(bron.schema).matchen.push(match);
  }

  const vanSoort = (soort: Schema['soort']) => javaVolgorde([...schemas.values()].filter((s) => s.soort === soort), (s) => s.id);
  const poules = vanSoort('poule');
  const afvalschemas = vanSoort('afvalschema');

  // Geeft een team op in een poule, dan tellen al zijn matchen in die poule niet mee voor de stand.
  for (const poule of poules) {
    const gafOp = new Set(poule.matchen.filter((m) => m.opgave).map(verliezer));
    for (const match of poule.matchen) {
      if (gafOp.has(match.team1) || gafOp.has(match.team2)) match.teltNiet = true;
    }
  }

  // Een kwalificatieschema staat niet in het draaiboek, maar komt voor: elke gespeelde match telt als een afvalschema van twee.
  for (const schema of vanSoort('kwalificatieschema')) {
    const perTeam = groepeer(schema.matchen.flatMap((m) => [m.team1, m.team2]).filter((t): t is Team => t != null), (t) => t);
    if ([...perTeam.values()].some((lijst) => lijst.length > 1)) {
      throw new Error(`Kwalificatieschema "${schema.naam}" kan niet verwerkt worden: een team speelt er meer dan één match.`);
    }
    schema.matchen
      .filter((m) => m.sets[0] != null)
      .forEach((match, index) => {
        afvalschemas.push({ id: 1001 + index, naam: `${schema.naam} (match ${index + 1})`, soort: 'afvalschema', onderdeel: schema.onderdeel, matchen: [match] });
      });
  }

  for (const poule of poules) poule.onderdeel?.poules.push(poule);
  for (const schema of afvalschemas) schema.onderdeel?.afvalschemas.push(schema);

  // Geen lidnummer in TP (manueel toegevoegd door de organisatie): 99 + maand en dag van de halte + volgnummer.
  let volgnummer = 1;
  const maandDag = toernooi.datum ? toernooi.datum.slice(5, 7) + toernooi.datum.slice(8, 10) : '0000';
  for (const s of javaVolgorde([...spelers.values()], (x) => x.id)) {
    if (!s.lidnummer) {
      s.lidnummer = `99${maandDag}${String(volgnummer++).padStart(2, '0')}`;
      s.tijdelijkLidnummer = true;
    }
  }

  const besteResultaat = new Map<Speler, number>();
  const resultaten: OnderdeelResultaat[] = [];
  for (const onderdeel of onderdelen.values()) {
    const stand = eindstand(onderdeel, waarschuwingen);
    const aantalTeams = stand.reduce((totaal, plaats) => totaal + plaats.length, 0);
    const maximum = onderdeel.reeks === 'B' && !altijdDubbeleSchemas ? 97 : 100;
    const resultaat: OnderdeelResultaat = {
      naam: onderdeel.naam,
      categorie: onderdeel.categorie.naam,
      reeks: onderdeel.reeks,
      teams: aantalTeams,
      maximum,
      opmerking: null,
    };
    resultaten.push(resultaat);

    if (onderdeel.poules.length === 0) {
      resultaat.opmerking = onderdeel.afvalschemas.length > 0 ? 'Geen poules, enkel een afvalschema: geen punten.' : 'Niet gespeeld.';
      continue;
    }
    if (aantalTeams < 4) {
      // Artikel 9.5: onderdelen met minder dan 3 wedstrijden komen niet in aanmerking voor punten.
      resultaat.opmerking = `Minder dan 4 teams: geen punten.`;
      continue;
    }
    stand.forEach((plaats, index) => {
      const voorDezePlaats = index < 20 ? maximum - index * 5 : 0;
      for (const t of plaats) {
        // Wie enkel walk-overs heeft, speelde niet: 0 punten.
        const punten = t.gespeeld > 0 ? voorDezePlaats : 0;
        for (const s of [t.speler1, t.speler2]) {
          if (!s) continue;
          const beste = besteResultaat.get(s);
          if (beste === undefined || punten > beste) besteResultaat.set(s, punten);
        }
      }
    });
  }

  const rijen = [...besteResultaat.entries()]
    .sort(
      ([a, puntenA], [b, puntenB]) =>
        a.categorie.volgorde - b.categorie.volgorde ||
        a.geslacht.localeCompare(b.geslacht) ||
        puntenB - puntenA ||
        `${a.naam} ${a.voornaam}`.localeCompare(`${b.naam} ${b.voornaam}`, 'nl'),
    )
    .map(([s, punten]): PuntenRij => ({
      lidnummer: s.lidnummer!,
      tijdelijkLidnummer: s.tijdelijkLidnummer,
      voornaam: s.voornaam,
      naam: s.naam,
      geslacht: s.geslacht,
      club: s.club,
      categorie: s.categorie.naam,
      punten,
    }));

  return { rijen, onderdelen: resultaten, waarschuwingen };
}

// ------------------------------------------------------------------ csv

function veld(waarde: string | null) {
  if (waarde == null) return '';
  const tekst = waarde.replace(/\r\n|\r|\n/g, ' ');
  return /[,"']/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
}

/**
 * De csv die de Excel van de ranking inleest, met dezelfde kolommen als de vroegere Azure-functie.
 * De kolom "tournament" is het volgnummer en de naam van de halte plus de datum, in hoofdletters: "03 LANDEGEM, 2026-03-15".
 * Het volgnummer houdt de haltes in de Excel op volgorde.
 */
export function naarCsv(rijen: PuntenRij[], volgnummerEnNaam: string, datum: string | null): string {
  const toernooi = `${volgnummerEnNaam}, ${datum ?? ''}`.toUpperCase();
  const regels = ['vblId,firstName,lastName,gender,clubName,ageCategory,tournament,point'];
  for (const r of rijen) {
    regels.push([r.lidnummer, r.voornaam, r.naam, r.geslacht, r.club, r.categorie, toernooi].map(veld).concat(String(r.punten)).join(','));
  }
  return regels.join('\r\n') + '\r\n';
}
