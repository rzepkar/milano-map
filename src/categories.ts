// Kategorien der eigenen Orte. Die Farben lehnen sich an die Linienfarben der
// Mailänder Metro an (Rot, Grün, Lila) und sind für weiße Beschriftung abgestimmt.
export type Kategorie =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'sehenswuerdigkeit'
  | 'park'
  | 'shop'
  | 'sonstiges';

export const KATEGORIEN: Record<Kategorie, { label: string; color: string }> = {
  restaurant: { label: 'Restaurant', color: '#D4141F' },
  cafe: { label: 'Café', color: '#B85C00' },
  bar: { label: 'Bar', color: '#7D3F98' },
  sehenswuerdigkeit: { label: 'Sehenswürdigkeit', color: '#0B6FB8' },
  park: { label: 'Park', color: '#0A8043' },
  shop: { label: 'Shop', color: '#B0236F' },
  sonstiges: { label: 'Sonstiges', color: '#4B5563' },
};

export const KATEGORIE_ORDER = Object.keys(KATEGORIEN) as Kategorie[];

export function isKategorie(value: unknown): value is Kategorie {
  return typeof value === 'string' && value in KATEGORIEN;
}

// MapLibre-Ausdruck: Farbe je nach Kategorie des Punktes.
export function colorExpression() {
  const pairs = KATEGORIE_ORDER.flatMap((k) => [k, KATEGORIEN[k].color]);
  return ['match', ['get', 'kategorie'], ...pairs, KATEGORIEN.sonstiges.color];
}
