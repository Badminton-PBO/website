/** Categorieën en reeksen (jongens, meisjes) van de jeugdcuptour. Los van astro:content, zodat ook /admin ze kan gebruiken. */
export const categorieen = [
  { id: 'minibad', label: 'Minibad' },
  { id: 'u11', label: 'U11' },
  { id: 'u13', label: 'U13' },
  { id: 'u15', label: 'U15' },
  { id: 'u17-u19', label: 'U17+U19' },
] as const;

/** De ranking telt per categorie apart voor jongens en meisjes. */
export const geslachten = [
  { id: 'jongens', label: 'Jongens' },
  { id: 'meisjes', label: 'Meisjes' },
] as const;

export type CategorieId = (typeof categorieen)[number]['id'];
export type GeslachtId = (typeof geslachten)[number]['id'];

/** Sleutel van een reeks: "u13-jongens". */
export type ReeksSleutel = `${CategorieId}-${GeslachtId}`;

/** De tien reeksen in de vaste volgorde, met hun sleutel en titel ("U13 jongens"). */
export const reeksen = categorieen.flatMap((c) =>
  geslachten.map((g) => ({
    categorie: c.id,
    geslacht: g.id,
    sleutel: `${c.id}-${g.id}` as ReeksSleutel,
    titel: `${c.label} ${g.label.toLowerCase()}`,
  })),
);

export const categorieLabel = (id: string) => categorieen.find((c) => c.id === id)?.label ?? id;
export const geslachtLabel = (id: string) => geslachten.find((g) => g.id === id)?.label ?? id;
