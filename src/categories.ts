// Kategorien der eigenen Orte, in der Reihenfolge der Filter-Chips.
// Die Farben sind für weiße Beschriftung abgestimmt.
export type Kategorie = 'restaurant' | 'gelato' | 'dolce' | 'other';

export const KATEGORIEN: Record<Kategorie, { label: string; color: string }> = {
  restaurant: { label: 'Restaurant', color: '#D4141F' },
  gelato: { label: 'Gelato', color: '#0B7A8A' },
  dolce: { label: 'Dolce', color: '#B0236F' },
  other: { label: 'Other', color: '#4B5563' },
};

export const KATEGORIE_ORDER = Object.keys(KATEGORIEN) as Kategorie[];

export function isKategorie(value: unknown): value is Kategorie {
  return typeof value === 'string' && value in KATEGORIEN;
}

// MapLibre-Ausdruck: Farbe je nach Kategorie des Punktes.
export function colorExpression() {
  const pairs = KATEGORIE_ORDER.flatMap((k) => [k, KATEGORIEN[k].color]);
  return ['match', ['get', 'kategorie'], ...pairs, KATEGORIEN.other.color];
}
