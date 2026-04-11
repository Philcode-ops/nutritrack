import { useState, useCallback, useRef } from 'react';
import { FoodItem, FoodSource } from '../constants/types';
import { generateId } from './generateId';

// ── USDA FoodData Central parser ────────────────────────────────────
// Endpoint: https://api.nal.usda.gov/fdc/v1/foods/search
// Nutrient IDs: 1008=Energy(kcal), 1003=Protein, 1004=Fat, 1005=Carbs
// All values per 100g.

function getNutrientValue(nutrients: any[], nutrientId: number): number {
  if (!Array.isArray(nutrients)) return 0;
  const n = nutrients.find((x: any) => x.nutrientId === nutrientId);
  return n?.value ?? 0;
}

function parseUSDA(data: any): FoodItem[] {
  if (!data?.foods) return [];
  return data.foods
    .filter((item: any) => item.description)
    .map((item: any) => ({
      id: generateId(),
      name: item.description || 'Unknown',
      brand: item.brandName || item.brandOwner || undefined,
      calories: Math.round(getNutrientValue(item.foodNutrients, 1008)),
      protein: Math.round(getNutrientValue(item.foodNutrients, 1003) * 10) / 10,
      fat: Math.round(getNutrientValue(item.foodNutrients, 1004) * 10) / 10,
      carbs: Math.round(getNutrientValue(item.foodNutrients, 1005) * 10) / 10,
      source: 'openfoodfacts' as const, // reuse the type for international
    }));
}

// ── Matvaretabellen parser ──────────────────────────────────────────
// API source: https://github.com/Mattilsynet/matvaretabellen-deux
// Compact endpoint: /api/nb/compact-foods.json
// Compact format from food->compact-api-data in pages/api.clj:
//   { id, foodGroupId, url, foodName, energyKj, energyKcal,
//     ediblePart, constituents: { "Prot": { quantity: [val, "g"] }, ... } }

function getConstituentValue(constituents: any, nutrientId: string): number {
  if (!constituents || typeof constituents !== 'object') return 0;
  const entry = constituents[nutrientId];
  if (entry == null) return 0;

  // Compact format: { quantity: [number, "unit"] }
  if (entry.quantity != null) {
    if (Array.isArray(entry.quantity)) {
      return typeof entry.quantity[0] === 'number' ? entry.quantity[0] : 0;
    }
    // quantity might be a direct number
    if (typeof entry.quantity === 'number') return entry.quantity;
  }

  // Full API format: { number: value, unit: "g" }  (after ->json: quantityNumber)
  if (typeof entry.quantityNumber === 'number') return entry.quantityNumber;
  if (typeof entry.number === 'number') return entry.number;

  // Direct number value
  if (typeof entry === 'number') return entry;

  return 0;
}

function parseSingleMatvareFood(f: any): FoodItem {
  // energyKcal is on the top-level food object.
  // If missing, try to get it from constituents under "Ener"
  const calories = f.energyKcal
    ?? getConstituentValue(f.constituents, 'Ener')
    ?? 0;

  return {
    id: generateId(),
    name: f.foodName || 'Ukjent',
    brand: undefined,
    calories: Math.round(calories),
    protein: Math.round(getConstituentValue(f.constituents, 'Prot') * 10) / 10,
    fat: Math.round(getConstituentValue(f.constituents, 'Fett') * 10) / 10,
    carbs: Math.round(getConstituentValue(f.constituents, 'Karbo') * 10) / 10,
    source: 'matvaretabellen' as const,
  };
}

// ── Matvaretabellen data loader (static API, cached) ────────────────

let matvareCache: any[] | null = null;
let matvareFetchPromise: Promise<any[]> | null = null;

async function fetchMatvaretabellenFoods(): Promise<any[]> {
  if (matvareCache) return matvareCache;
  if (matvareFetchPromise) return matvareFetchPromise;

  matvareFetchPromise = (async () => {
    // URL pattern from urls.cljc: (str "/api/" (name locale) "/compact-foods.json")
    const urls = [
      'https://www.matvaretabellen.no/api/nb/compact-foods.json',
      'https://www.matvaretabellen.no/api/en/compact-foods.json',
    ];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeout);

        if (!res.ok) continue;
        const data = await res.json();

        // Response could be a plain array or { foods: [...] } or other wrapper
        let foods: any[];
        if (Array.isArray(data)) {
          foods = data;
        } else if (Array.isArray(data.foods)) {
          foods = data.foods;
        } else if (typeof data === 'object') {
          // Maybe the response is a map keyed by food ID
          const values = Object.values(data);
          if (values.length > 0 && typeof values[0] === 'object') {
            foods = values as any[];
          } else {
            continue;
          }
        } else {
          continue;
        }

        if (foods.length > 0) {
          matvareCache = foods;
          return foods;
        }
      } catch {
        continue;
      }
    }

    // Reset promise so user can retry
    matvareFetchPromise = null;
    return [];
  })();

  return matvareFetchPromise;
}

function searchMatvareFoods(foods: any[], query: string): FoodItem[] {
  const lower = query.toLowerCase();
  const terms = lower.split(/\s+/).filter(Boolean);

  return foods
    .filter((f) => {
      const name = (f.foodName || '').toLowerCase();
      return terms.every((term) => name.includes(term));
    })
    .slice(0, 25)
    .map(parseSingleMatvareFood);
}

// ── Hook ────────────────────────────────────────────────────────────

export function useFoodSearch() {
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<FoodSource>('norwegian');
  const searchIdRef = useRef(0);

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      const currentId = ++searchIdRef.current;
      setLoading(true);
      setError(null);

      try {
        let items: FoodItem[];

        if (source === 'international') {
          const encoded = encodeURIComponent(query.trim());
          const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encoded}&dataType=Foundation,SR%20Legacy&pageSize=20&api_key=DEMO_KEY`;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
          });
          clearTimeout(timeout);

          if (!res.ok) throw new Error(`USDA API returned ${res.status}`);
          const data = await res.json();
          items = parseUSDA(data);
          if (items.length === 0) {
            throw new Error('No results found. Try a different search term.');
          }
        } else {
          const allFoods = await fetchMatvaretabellenFoods();
          if (allFoods.length === 0) {
            throw new Error(
              'Could not load Norwegian food database. Check your internet connection and try again.'
            );
          }
          items = searchMatvareFoods(allFoods, query.trim());
          if (items.length === 0) {
            throw new Error('No Norwegian foods matched your search.');
          }
        }

        if (currentId === searchIdRef.current) {
          setResults(items);
          setError(null);
        }
      } catch (err: any) {
        if (currentId === searchIdRef.current) {
          const msg = err.name === 'AbortError'
            ? 'Search timed out. Please try again.'
            : (err.message || 'Search failed');
          setError(msg);
          setResults([]);
        }
      } finally {
        if (currentId === searchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [source]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, loading, error, source, setSource, search, clearResults };
}
