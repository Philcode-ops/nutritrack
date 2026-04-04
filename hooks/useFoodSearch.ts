import { useState, useCallback } from 'react';
import { FoodItem, FoodSource } from '../constants/types';
import { v4 as uuidv4 } from 'uuid';

function parseOpenFoodFacts(data: any): FoodItem[] {
  if (!data?.products) return [];
  return data.products
    .filter((p: any) => p.product_name)
    .map((p: any) => ({
      id: uuidv4(),
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

function parseMatvaretabellen(data: any): FoodItem[] {
  if (!data?.foods) return [];
  return data.foods.map((f: any) => {
    const nutrients = f.nutrients || {};
    const getVal = (id: string) => {
      const n = nutrients[id];
      return n?.quantity ?? 0;
    };
    return {
      id: uuidv4(),
      name: f.foodName || f.foodNameNo || 'Ukjent',
      brand: undefined,
      calories: Math.round(getVal('Ener')),
      carbs: Math.round(getVal('Karbo') * 10) / 10,
      fat: Math.round(getVal('Fett') * 10) / 10,
      protein: Math.round(getVal('Prot') * 10) / 10,
      source: 'matvaretabellen' as const,
    };
  });
}

export function useFoodSearch() {
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<FoodSource>('international');

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const encoded = encodeURIComponent(query.trim());
        let items: FoodItem[];

        if (source === 'international') {
          const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encoded}&fields=product_name,brands,nutriments,serving_size&lang=en&page_size=20`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch from Open Food Facts');
          const data = await res.json();
          items = parseOpenFoodFacts(data);
        } else {
          const url = `https://www.matvaretabellen.no/api/foods/?search=${encoded}&language=no`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch from Matvaretabellen');
          const data = await res.json();
          items = parseMatvaretabellen(data);
        }

        setResults(items);
      } catch (err: any) {
        setError(err.message || 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
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
