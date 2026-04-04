import { useMemo } from 'react';
import { useStorage } from './useStorage';
import {
  FoodLogEntry,
  CustomMeal,
  UserProfile,
  ACTIVITY_MULTIPLIERS,
} from '../constants/types';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  currentWeight: 70,
  goalWeight: 70,
  age: 30,
  gender: 'male',
  activityLevel: 'moderate',
};

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calculateBMR(profile: UserProfile): number {
  // Mifflin-St Jeor Equation
  const base = 10 * profile.currentWeight + 6.25 * 170 - 5 * profile.age;
  return profile.gender === 'male' ? base + 5 : base - 161;
}

export function useNutrition() {
  const [foodLog, setFoodLog, logLoaded] = useStorage<FoodLogEntry[]>('food_log', []);
  const [customMeals, setCustomMeals, mealsLoaded] = useStorage<CustomMeal[]>('custom_meals', []);
  const [profile, setProfile, profileLoaded] = useStorage<UserProfile>('user_profile', DEFAULT_PROFILE);

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

  const calorieGoal = useMemo(() => {
    if (profile.manualCalorieGoal && profile.manualCalorieGoal > 0) {
      return profile.manualCalorieGoal;
    }
    const bmr = calculateBMR(profile);
    const tdee = bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];
    // If goal weight < current, deficit; if >, surplus
    if (profile.goalWeight < profile.currentWeight) {
      return Math.round(tdee - 500); // moderate deficit
    } else if (profile.goalWeight > profile.currentWeight) {
      return Math.round(tdee + 300); // moderate surplus
    }
    return Math.round(tdee); // maintain
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
    calorieGoal,
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
