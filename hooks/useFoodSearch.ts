import { useState, useCallback, useRef } from 'react';
import { FoodItem, FoodSource } from '../constants/types';
import { generateId } from './generateId';

function parseOpenFoodFacts(data: any): FoodItem[] {
  if (!data?.products) return [];
  return data.products
    .filter((p: any) => p.product_name)
    .map((p: any) => ({
      id: generateId(),
      name: p.product_name || 'Unknown',
      brand: p.brands || undefined,
      calories: Math.round(p.nutriments?.['energy-kcal_100g'] || p.nutriments?.['energy-kcal'] || 0),
      carbs: Math.round((p.nutriments?.carbohydrates_100g || 0) * 10) / 10,
      fat: Math.round((p.nutriments?.fat_100g || 0) * 10) / 10,
      protein: Math.round((p.nutriments?.proteins_100g || 0) * 10) / 10,
      servingSize: p.serving_size || undefined,
      source: 'openfoodfacts' as const,
    }));
}

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
  // Direct number
  if (typeof entry === 'number') return entry;
  return 0;
}

function parseSingleMatvareFood(f: any): FoodItem {
  return {
    id: generateId(),
    name: f.foodName || f.foodNameNo || 'Ukjent',
    brand: undefined,
    calories: Math.round(f.energyKcal ?? 0),
    carbs: Math.round(getConstituentValue(f.constituents, 'Karbo') * 10) / 10,
    fat: Math.round(getConstituentValue(f.constituents, 'Fett') * 10) / 10,
    protein: Math.round(getConstituentValue(f.constituents, 'Prot') * 10) / 10,
    source: 'matvaretabellen' as const,
  };
}

// Cache for the full Matvaretabellen food list (static API)
let matvareCachePromise: Promise<any[]> | null = null;

async function fetchMatvaretabellenFoods(): Promise<any[]> {
  if (matvareCachePromise) return matvareCachePromise;

  matvareCachePromise = (async () => {
    // Try the compact endpoint first (smaller payload)
    const urls = [
      'https://www.matvaretabellen.no/api/foods/compact/no.json',
      'https://www.matvaretabellen.no/api/foods/no.json',
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        // Response could be {foods: [...]} or just an array
        const foods = Array.isArray(data) ? data : (data.foods || []);
        if (foods.length > 0) return foods;
      } catch {
        continue;
      }
    }
    return [];
  })();

  return matvareCachePromise;
}

function searchMatvareFoods(foods: any[], query: string): FoodItem[] {
  const lower = query.toLowerCase();
  const terms = lower.split(/\s+/).filter(Boolean);

  return foods
    .filter((f) => {
      const name = (f.foodName || '').toLowerCase();
      return terms.every((term) => name.includes(term));
    })
    .slice(0, 20)
    .map(parseSingleMatvareFood);
}

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
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch from Open Food Facts');
          const data = await res.json();
          items = parseOpenFoodFacts(data);
        } else {
          const allFoods = await fetchMatvaretabellenFoods();
          if (allFoods.length === 0) {
            throw new Error('Could not load Norwegian food database');
          }
          items = searchMatvareFoods(allFoods, query.trim());
        }

        // Only update if this is still the latest search
        if (currentId === searchIdRef.current) {
          setResults(items);
        }
      } catch (err: any) {
        if (currentId === searchIdRef.current) {
          setError(err.message || 'Search failed');
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
