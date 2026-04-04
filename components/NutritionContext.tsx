import React, { createContext, useContext } from 'react';
import { useNutrition } from '../hooks/useNutrition';

type NutritionContextType = ReturnType<typeof useNutrition>;

const NutritionContext = createContext<NutritionContextType | null>(null);

export function NutritionProvider({ children }: { children: React.ReactNode }) {
  const nutrition = useNutrition();
  return (
    <NutritionContext.Provider value={nutrition}>
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutritionContext(): NutritionContextType {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutritionContext must be used within NutritionProvider');
  return ctx;
}
