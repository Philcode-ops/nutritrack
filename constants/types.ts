import type { GoalMode as _GoalMode, ActivityLevel as _ActivityLevel } from './nutrition';

export type GoalMode = _GoalMode;
export type ActivityLevel = _ActivityLevel;
export type { BodyData, NutritionProfile, DailyTargets } from './nutrition';
export { ACTIVITY_FACTORS, ACTIVITY_LABELS, GOAL_MODE_LABELS } from './nutrition';

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

/** Persisted user profile. Matches NutritionProfile shape for the engine. */
export interface UserProfile {
  name: string;
  currentWeight: number;
  goalWeight: number;
  height: number;
  age: number;
  gender: 'male' | 'female';
  bodyFatPercent?: number;
  activityLevel: ActivityLevel;
  goalMode: GoalMode;
  manualCalorieGoal?: number;
}

export type FoodSource = 'international' | 'norwegian';

export type { WeightEntry, WeightStatus, TimeRange, WeightSummary, WeightInsight } from './weight';
export {
  MIN_ENTRIES_FOR_TREND,
  PLATEAU_THRESHOLD_KG_PER_WEEK,
  EWMA_ALPHA,
  TIME_RANGE_DAYS,
} from './weight';
