export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  calories: number; // per 100g
  carbs: number;    // per 100g
  fat: number;      // per 100g
  protein: number;  // per 100g
  servingSize?: string;
  source: 'openfoodfacts' | 'matvaretabellen' | 'custom';
}

export interface FoodLogEntry {
  id: string;
  food: FoodItem;
  grams: number;
  date: string; // ISO date string YYYY-MM-DD
  timestamp: number;
}

export interface CustomMeal {
  id: string;
  name: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
}

export interface UserProfile {
  name: string;
  currentWeight: number;
  goalWeight: number;
  age: number;
  gender: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  manualCalorieGoal?: number;
}

export type FoodSource = 'international' | 'norwegian';

export const ACTIVITY_MULTIPLIERS: Record<UserProfile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<UserProfile['activityLevel'], string> = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  active: 'Active',
  very_active: 'Very Active',
};
