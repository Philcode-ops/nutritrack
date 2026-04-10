import { useMemo } from 'react';
import { useStorage } from './useStorage';
import { FoodLogEntry, CustomMeal, UserProfile } from '../constants/types';
import {
  computeAllTargets,
  NutritionProfile,
  DailyTargets,
} from '../constants/nutrition';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  currentWeight: 75,
  goalWeight: 75,
  height: 175,
  age: 30,
  gender: 'male',
  activityLevel: 'moderate',
  goalMode: 'maintenance',
};

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Convert the persisted UserProfile into the NutritionProfile the engine expects. */
function toNutritionProfile(p: UserProfile): NutritionProfile {
  return {
    body: {
      currentWeightKg: p.currentWeight,
      goalWeightKg: p.goalWeight,
      heightCm: p.height,
      age: p.age,
      gender: p.gender,
      bodyFatPercent: p.bodyFatPercent,
    },
    activityLevel: p.activityLevel,
    goalMode: p.goalMode,
    manualCalorieOverride: p.manualCalorieGoal,
  };
}

export function useNutrition() {
  const [foodLog, setFoodLog, logLoaded] = useStorage<FoodLogEntry[]>('food_log', []);
  const [customMeals, setCustomMeals, mealsLoaded] = useStorage<CustomMeal[]>('custom_meals', []);
  const [profile, setProfile, profileLoaded] = useStorage<UserProfile>('user_profile_v2', DEFAULT_PROFILE);

  const today = getTodayKey();

  const todayEntries = useMemo(
    () => foodLog.filter((e) => e.date === today).sort((a, b) => b.timestamp - a.timestamp),
    [foodLog, today]
  );

  const todayTotals = useMemo(() => {
    return todayEntries.reduce(
      (acc, entry) => {
        const factor = entry.grams / 100;
        return {
          calories: acc.calories + entry.food.calories * factor,
          carbs: acc.carbs + entry.food.carbs * factor,
          fat: acc.fat + entry.food.fat * factor,
          protein: acc.protein + entry.food.protein * factor,
        };
      },
      { calories: 0, carbs: 0, fat: 0, protein: 0 }
    );
  }, [todayEntries]);

  const targets: DailyTargets = useMemo(() => {
    return computeAllTargets(toNutritionProfile(profile));
  }, [profile]);

  const addFoodEntry = (entry: FoodLogEntry) => {
    setFoodLog((prev) => [...prev, entry]);
  };

  const removeFoodEntry = (id: string) => {
    setFoodLog((prev) => prev.filter((e) => e.id !== id));
  };

  const addCustomMeal = (meal: CustomMeal) => {
    setCustomMeals((prev) => [...prev, meal]);
  };

  const removeCustomMeal = (id: string) => {
    setCustomMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const loaded = logLoaded && mealsLoaded && profileLoaded;

  return {
    foodLog,
    todayEntries,
    todayTotals,
    targets,
    customMeals,
    profile,
    loaded,
    addFoodEntry,
    removeFoodEntry,
    addCustomMeal,
    removeCustomMeal,
    setProfile,
  };
}
