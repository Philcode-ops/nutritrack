import { useState, useCallback, useRef } from 'react';
import { FoodItem, FoodSource } from '../constants/types';
import { generateId } from './generateId';

// ── Open Food Facts parser ──────────────────────────────────────────

function parseOpenFoodFacts(data: any): FoodItem[] {
  if (!data?.products) return [];
  return data.products
    .filter((p: any) => p.product_name)
    .map((p: any) => ({
      id: generateId(),
      name: p.product_name || 'Unknown',
      brand: p.brands || undefined,
      calories: Math.round(p.nutriments?.['energy-kcal_100g'] ?? p.nutriments?.['energy-kcal'] ?? 0),
      carbs: Math.round((p.nutriments?.carbohydrates_100g ?? 0) * 10) / 10,
      fat: Math.round((p.nutriments?.fat_100g ?? 0) * 10) / 10,
      protein: Math.round((p.nutriments?.proteins_100g ?? 0) * 10) / 10,
      servingSize: p.serving_size || undefined,
      source: 'openfoodfacts' as const,
    }));
}

// ── Matvaretabellen parser ──────────────────────────────────────────
// API source: https://github.com/Mattilsynet/matvaretabellen-deux
// Compact format: food->compact-api-data in pages/api.clj
// Fields: { id, foodGroupId, url, foodName, energyKj, energyKcal,
//           ediblePart, constituents: { "Prot": { quantity: [val, "g"] }, ... } }

function getConstituentValue(constituents: any, nutrientId: string): number {
  if (!constituents) return 0;
  const entry = constituents[nutrientId];
  if (!entry) return 0;
  // Compact format: { quantity: [number, "unit"] }
  if (entry.quantity && Array.isArray(entry.quantity)) {
    return entry.quantity[0] ?? 0;
  }
  // Full format: { number: value, unit: "g" }
  if (typeof entry.number === 'number') return entry.number;
  if (typeof entry === 'number') return entry;
  return 0;
}

function parseSingleMatvareFood(f: any): FoodItem {
  return {
    id: generateId(),
    name: f.foodName || 'Ukjent',
    brand: undefined,
    calories: Math.round(f.energyKcal ?? 0),
    carbs: Math.round(getConstituentValue(f.constituents, 'Karbo') * 10) / 10,
    fat: Math.round(getConstituentValue(f.constituents, 'Fett') * 10) / 10,
    protein: Math.round(getConstituentValue(f.constituents, 'Prot') * 10) / 10,
    source: 'matvaretabellen' as const,
  };
}

// ── Matvaretabellen data loader (static API, cached) ────────────────
// The API is a statically generated site. No server-side search.
// We fetch the full compact list once and filter client-side.

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

        // Response is either a plain array or { foods: [...] }
        const foods = Array.isArray(data) ? data : (data.foods || data);
        if (Array.isArray(foods) && foods.length > 0) {
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
  const [source, setSource] = useState<FoodSource>('international');
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
          const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encoded}&fields=product_name,brands,nutriments,serving_size&lang=en&page_size=20`;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'NutriTrack/1.0 (nutrition-tracker-app)',
            },
          });
          clearTimeout(timeout);

          if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
          const data = await res.json();
          items = parseOpenFoodFacts(data);
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
