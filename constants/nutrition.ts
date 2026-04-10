// ═══════════════════════════════════════════════════════════════════
// NutriTrack — Evidence-Based Nutrition Engine
// ═══════════════════════════════════════════════════════════════════
//
// Architecture:
//   1. estimateRMR()           — Resting Metabolic Rate (Mifflin-St Jeor or Cunningham)
//   2. estimateInitialTDEE()   — TDEE = RMR × activity factor (starting estimate)
//   3. chooseCalorieTarget()   — Goal-specific calorie target
//   4. chooseProteinTarget()   — g/kg/day based on goal mode + body weight
//   5. chooseFatTarget()       — Minimum floor first, then mode adjustment
//   6. chooseCarbTarget()      — Fills remaining calories after protein + fat
//   7. computeAllTargets()     — Single entry point returning complete daily targets
//
// Designed for future adaptive TDEE correction from weight-trend + intake data.
// ═══════════════════════════════════════════════════════════════════

// ── Types ───────────────────────────────────────────────────────────

export type GoalMode =
  | 'maintenance'
  | 'fat_loss'
  | 'muscle_gain'
  | 'endurance'
  | 'strength';

export type ActivityLevel =
  | 'sedentary'      // desk job, minimal movement
  | 'light'          // 1-2 sessions/week or active job
  | 'moderate'       // 3-4 sessions/week
  | 'active'         // 5-6 sessions/week or physical job + training
  | 'very_active';   // 2x/day training, heavy manual labor + training

export interface BodyData {
  currentWeightKg: number;
  goalWeightKg: number;
  heightCm: number;
  age: number;
  gender: 'male' | 'female';
  bodyFatPercent?: number;  // Optional — enables Cunningham formula
}

export interface NutritionProfile {
  body: BodyData;
  activityLevel: ActivityLevel;
  goalMode: GoalMode;
  manualCalorieOverride?: number;
}

export interface DailyTargets {
  rmr: number;
  tdee: number;
  calories: number;
  protein: number;    // grams
  fat: number;        // grams
  carbs: number;      // grams
  isManualOverride: boolean;
  goalMode: GoalMode;
}

// ── Configuration ───────────────────────────────────────────────────
// All ranges are evidence-based starting points. Each can be tuned per user.

/** Activity multipliers applied to RMR to estimate initial TDEE.
 *  These are starting estimates only — designed to be replaced by
 *  adaptive TDEE once enough weight-trend data is available. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (desk job, minimal movement)',
  light: 'Light (1–2 sessions/week)',
  moderate: 'Moderate (3–4 sessions/week)',
  active: 'Active (5–6 sessions/week)',
  very_active: 'Very Active (2×/day or heavy labor)',
};

export const GOAL_MODE_LABELS: Record<GoalMode, string> = {
  maintenance: 'General Health / Maintenance',
  fat_loss: 'Fat Loss',
  muscle_gain: 'Muscle Gain',
  endurance: 'Endurance',
  strength: 'Strength / Hybrid',
};

/** Protein targets in g/kg/day by goal mode.
 *  Based on current body weight (or adjusted weight for high-BF users).
 *  References:
 *    - Morton et al. 2018 meta-analysis: 1.6 g/kg for hypertrophy
 *    - Helms et al. 2014: 2.3–3.1 g/kg lean mass during deficit
 *    - ISSN position stand 2017: 1.4–2.0 g/kg for exercising individuals
 *    - Jäger et al. 2017: up to 2.2 g/kg for strength athletes */
const PROTEIN_CONFIG: Record<GoalMode, { min: number; max: number }> = {
  maintenance: { min: 1.4, max: 1.8 },
  fat_loss:    { min: 2.0, max: 2.4 },   // Higher to preserve lean mass in deficit
  muscle_gain: { min: 1.8, max: 2.2 },   // Moderate-high for hypertrophy
  endurance:   { min: 1.4, max: 1.8 },   // Adequate, not excessive
  strength:    { min: 2.0, max: 2.4 },   // Higher for strength/hybrid
};

/** Fat minimum as g/kg/day — floor to support hormones & satiety.
 *  Below ~0.7 g/kg risks hormonal disruption (especially in women).
 *  Reference: Helms et al. 2014, ISSN recommendations. */
const FAT_CONFIG: Record<GoalMode, { minGPerKg: number; targetPctOfCal: number }> = {
  maintenance: { minGPerKg: 0.8, targetPctOfCal: 0.30 },
  fat_loss:    { minGPerKg: 0.7, targetPctOfCal: 0.25 },  // Lower but protected floor
  muscle_gain: { minGPerKg: 0.8, targetPctOfCal: 0.28 },
  endurance:   { minGPerKg: 0.8, targetPctOfCal: 0.25 },  // More room for carbs
  strength:    { minGPerKg: 0.8, targetPctOfCal: 0.28 },
};

/** Calorie adjustment from TDEE by goal mode.
 *  Deficit/surplus expressed as absolute kcal range + rate guidance. */
const CALORIE_CONFIG: Record<GoalMode, {
  adjustmentKcal: number;       // Negative = deficit, positive = surplus
  minCalories: number;          // Safety floor
}> = {
  maintenance: { adjustmentKcal: 0, minCalories: 1200 },
  fat_loss:    { adjustmentKcal: -500, minCalories: 1200 },   // ~0.5 kg/week loss
  muscle_gain: { adjustmentKcal: 250, minCalories: 1500 },    // Lean bulk
  endurance:   { adjustmentKcal: 0, minCalories: 1500 },      // Fuel the work
  strength:    { adjustmentKcal: 100, minCalories: 1400 },     // Slight surplus for recovery
};

// ── Core Functions ──────────────────────────────────────────────────

/** Mifflin-St Jeor equation for Resting Metabolic Rate.
 *  Reference: Mifflin et al. 1990, validated as most accurate
 *  for non-obese populations without body composition data. */
function mifflinStJeor(body: BodyData): number {
  const base = 10 * body.currentWeightKg + 6.25 * body.heightCm - 5 * body.age;
  return body.gender === 'male' ? base + 5 : base - 161;
}

/** Cunningham equation — requires reliable lean body mass data.
 *  RMR = 500 + 22 × LBM(kg)
 *  Reference: Cunningham 1991. More accurate when BF% is known. */
function cunningham(body: BodyData): number {
  if (body.bodyFatPercent == null || body.bodyFatPercent <= 0 || body.bodyFatPercent >= 60) {
    return mifflinStJeor(body);
  }
  const lbm = body.currentWeightKg * (1 - body.bodyFatPercent / 100);
  return 500 + 22 * lbm;
}

/** Choose the best RMR estimate based on available data. */
export function estimateRMR(body: BodyData): number {
  if (body.bodyFatPercent != null && body.bodyFatPercent > 5 && body.bodyFatPercent < 50) {
    return Math.round(cunningham(body));
  }
  return Math.round(mifflinStJeor(body));
}

/** Initial TDEE estimate from RMR × activity factor.
 *  This is a starting point only. In future, adaptive TDEE from
 *  weight-trend + intake data should override this. */
export function estimateInitialTDEE(body: BodyData, activity: ActivityLevel): number {
  const rmr = estimateRMR(body);
  return Math.round(rmr * ACTIVITY_FACTORS[activity]);
}

/** Derive a weight-basis for macros. For users with high body fat (>30%),
 *  we use an adjusted weight to avoid grossly over-estimating protein needs.
 *  Adjusted = lean mass + 0.4 × fat mass. */
function getProteinWeightBasis(body: BodyData): number {
  if (
    body.bodyFatPercent != null &&
    body.bodyFatPercent > 30
  ) {
    const lbm = body.currentWeightKg * (1 - body.bodyFatPercent / 100);
    const fatMass = body.currentWeightKg * (body.bodyFatPercent / 100);
    return lbm + 0.4 * fatMass;
  }
  return body.currentWeightKg;
}

/** Calorie target for the given goal mode. */
export function chooseCalorieTarget(
  tdee: number,
  goalMode: GoalMode,
): number {
  const config = CALORIE_CONFIG[goalMode];
  const raw = tdee + config.adjustmentKcal;
  return Math.max(Math.round(raw), config.minCalories);
}

/** Protein target in grams/day.
 *  Uses midpoint of the mode's g/kg range × body-weight basis. */
export function chooseProteinTarget(body: BodyData, goalMode: GoalMode): number {
  const config = PROTEIN_CONFIG[goalMode];
  const mid = (config.min + config.max) / 2;
  const basis = getProteinWeightBasis(body);
  return Math.round(mid * basis);
}

/** Fat target in grams/day.
 *  Ensures the g/kg minimum floor, then aims for target% of calories. */
export function chooseFatTarget(
  body: BodyData,
  calories: number,
  goalMode: GoalMode,
): number {
  const config = FAT_CONFIG[goalMode];
  const floor = Math.round(config.minGPerKg * body.currentWeightKg);
  const pctBased = Math.round((calories * config.targetPctOfCal) / 9);
  return Math.max(floor, pctBased);
}

/** Carb target — fills remaining calories after protein and fat. */
export function chooseCarbTarget(
  calories: number,
  proteinG: number,
  fatG: number,
): number {
  const remaining = calories - (proteinG * 4) - (fatG * 9);
  return Math.max(Math.round(remaining / 4), 0);
}

// ── Adaptive TDEE placeholder ───────────────────────────────────────
// These stubs exist so the architecture supports future adaptive correction
// from real weight-trend + intake data.

/** Placeholder: once weight logs span ≥2 weeks and calorie intake is tracked,
 *  TDEE can be reverse-calculated from actual energy balance.
 *  Returns null until enough data is available. */
export function updateAdaptiveTDEEFromWeightTrend(
  _weightEntries: { date: string; kg: number }[],
  _calorieEntries: { date: string; kcal: number }[],
): number | null {
  // TODO: implement when weight logging history is available
  // Algorithm: averageIntake - (weightChangeKg × 7700 / days) = estimated TDEE
  return null;
}

/** Placeholder: derive a refined activity score from step count,
 *  exercise sessions, and subjective recovery rating. */
export function deriveActivityScore(
  _stepsPerDay?: number,
  _exerciseSessionsPerWeek?: number,
): ActivityLevel {
  // TODO: implement with real sensor/log data
  return 'moderate';
}

// ── Main entry point ────────────────────────────────────────────────

/** Compute all daily nutrition targets from a user's profile. */
export function computeAllTargets(profile: NutritionProfile): DailyTargets {
  const { body, activityLevel, goalMode, manualCalorieOverride } = profile;

  const rmr = estimateRMR(body);
  const tdee = estimateInitialTDEE(body, activityLevel);

  const isManualOverride = manualCalorieOverride != null && manualCalorieOverride > 0;
  const calories = isManualOverride
    ? manualCalorieOverride!
    : chooseCalorieTarget(tdee, goalMode);

  const protein = chooseProteinTarget(body, goalMode);
  const fat = chooseFatTarget(body, calories, goalMode);
  const carbs = chooseCarbTarget(calories, protein, fat);

  return {
    rmr,
    tdee,
    calories,
    protein,
    fat,
    carbs,
    isManualOverride,
    goalMode,
  };
}
