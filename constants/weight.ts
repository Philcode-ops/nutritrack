// ═══════════════════════════════════════════════════════════════════
// NutriTrack — Weight Tracking Engine
// ═══════════════════════════════════════════════════════════════════
//
// Architecture:
//   1. Data model (WeightEntry) — one entry per date, replace on conflict
//   2. Trend analysis — EWMA for irregular logging frequency
//   3. Summary metrics — 7D/30D/90D/all-time changes + rate/week
//   4. Goal-aware status — on_track/plateau/wrong_direction by goal mode
//   5. Export readiness — CSV-formatted output function
//
// All thresholds are configurable constants at the top of this file.
// ═══════════════════════════════════════════════════════════════════

import { GoalMode } from './nutrition';

// ── Types ───────────────────────────────────────────────────────────

export interface WeightEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  weight_kg: number;
  created_at: number;    // Unix timestamp ms
  updated_at: number;    // Unix timestamp ms
}

export type WeightStatus = 'on_track' | 'plateau' | 'wrong_direction' | 'insufficient_data';

export type TimeRange = '1W' | '1M' | '3M' | '1Y' | 'ALL';

export interface WeightSummary {
  current: number | null;
  change7d: number | null;
  change30d: number | null;
  change90d: number | null;
  changeAll: number | null;
  startWeight: number | null;
  minWeight: number | null;
  maxWeight: number | null;
  totalEntries: number;
  firstDate: string | null;
  ratePerWeek: number | null;  // kg/week over recent data
}

export interface WeightInsight {
  status: WeightStatus;
  title: string;
  message: string;
}

// ── Configurable Thresholds ─────────────────────────────────────────

/** Minimum entries needed before showing trend analysis */
export const MIN_ENTRIES_FOR_TREND = 3;

/** Minimum days span needed for reliable rate calculation */
export const MIN_DAYS_FOR_RATE = 7;

/** Less than this kg/week absolute change = plateau */
export const PLATEAU_THRESHOLD_KG_PER_WEEK = 0.1;

/** Muscle gain: above this kg/week = gaining too fast */
export const FAST_GAIN_THRESHOLD_KG_PER_WEEK = 0.5;

/** Maintenance: above this kg/week drift = wrong direction */
export const MAINTENANCE_DRIFT_THRESHOLD_KG_PER_WEEK = 0.3;

/** EWMA smoothing factor (lower = smoother, range 0-1) */
export const EWMA_ALPHA = 0.3;

/** How close to goal (kg) counts as "at goal" */
export const AT_GOAL_TOLERANCE_KG = 0.5;

/** Time range durations in days (null = all time) */
export const TIME_RANGE_DAYS: Record<TimeRange, number | null> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
  'ALL': null,
};

// ── Date Utilities ──────────────────────────────────────────────────

/** Format a Date object to YYYY-MM-DD using local time */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse YYYY-MM-DD to a local-time timestamp (avoids UTC midnight issues) */
export function dateToTimestamp(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Get today's date as YYYY-MM-DD */
export function getTodayKey(): string {
  return formatDate(new Date());
}

/** Format date for display: "Apr 11" or "Apr 11, 2025" if different year */
export function formatDisplayDate(dateStr: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = dateStr.split('-').map(Number);
  const currentYear = new Date().getFullYear();
  const monthStr = MONTHS[m - 1];
  if (y !== currentYear) {
    return `${monthStr} ${d}, ${y}`;
  }
  return `${monthStr} ${d}`;
}

/** Get a human-readable label for a date relative to today */
export function getRelativeDateLabel(dateStr: string): string {
  const today = getTodayKey();
  if (dateStr === today) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === formatDate(yesterday)) return 'Yesterday';

  return formatDisplayDate(dateStr);
}

/** Shift a YYYY-MM-DD string by N days */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

// ── Core Calculations ───────────────────────────────────────────────

/** Sort entries by date ascending */
export function sortByDate(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

/** Filter entries to those within the last N days (null = no filter) */
export function filterByDays(entries: WeightEntry[], days: number | null): WeightEntry[] {
  if (days === null) return entries;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = formatDate(cutoff);
  return entries.filter(e => e.date >= cutoffStr);
}

/** Calculate EWMA trend line for sorted entries.
 *  Returns an array of smoothed weight values, one per entry.
 *  Handles irregular spacing: entries far apart get less smoothing. */
export function calculateEWMA(entries: WeightEntry[], alpha: number = EWMA_ALPHA): number[] {
  if (entries.length === 0) return [];
  const trend: number[] = [entries[0].weight_kg];
  for (let i = 1; i < entries.length; i++) {
    // Adjust alpha based on time gap: more gap = more weight on new observation
    const dayGap = (dateToTimestamp(entries[i].date) - dateToTimestamp(entries[i - 1].date)) / (1000 * 60 * 60 * 24);
    const adjustedAlpha = 1 - Math.pow(1 - alpha, Math.min(dayGap, 7));
    trend.push(adjustedAlpha * entries[i].weight_kg + (1 - adjustedAlpha) * trend[i - 1]);
  }
  return trend;
}

/** Calculate rate of weight change in kg per week */
export function calculateRatePerWeek(sorted: WeightEntry[]): number | null {
  if (sorted.length < 2) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const daysDiff = (dateToTimestamp(last.date) - dateToTimestamp(first.date)) / (1000 * 60 * 60 * 24);
  if (daysDiff < MIN_DAYS_FOR_RATE) return null;
  const weightChange = last.weight_kg - first.weight_kg;
  return Math.round((weightChange / daysDiff) * 7 * 100) / 100;
}

/** Get weight change over a specific number of days.
 *  Finds the entry closest to (but not after) the cutoff date and
 *  compares with the latest entry. */
export function getChangeOverDays(sorted: WeightEntry[], days: number): number | null {
  if (sorted.length < 2) return null;
  const latest = sorted[sorted.length - 1];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = formatDate(cutoff);

  // Find entry closest to cutoff (on or before)
  let closest: WeightEntry | null = null;
  for (const entry of sorted) {
    if (entry.date <= cutoffStr) {
      closest = entry;
    }
  }
  if (!closest) return null;
  return Math.round((latest.weight_kg - closest.weight_kg) * 10) / 10;
}

/** Compute full weight summary from all entries */
export function computeWeightSummary(entries: WeightEntry[]): WeightSummary {
  if (entries.length === 0) {
    return {
      current: null, change7d: null, change30d: null, change90d: null,
      changeAll: null, startWeight: null, minWeight: null, maxWeight: null,
      totalEntries: 0, firstDate: null, ratePerWeek: null,
    };
  }

  const sorted = sortByDate(entries);
  const current = sorted[sorted.length - 1].weight_kg;
  const startWeight = sorted[0].weight_kg;
  const weights = sorted.map(e => e.weight_kg);

  // Rate from last 30 days
  const last30 = sortByDate(filterByDays(sorted, 30));

  return {
    current,
    change7d: getChangeOverDays(sorted, 7),
    change30d: getChangeOverDays(sorted, 30),
    change90d: getChangeOverDays(sorted, 90),
    changeAll: sorted.length >= 2 ? Math.round((current - startWeight) * 10) / 10 : null,
    startWeight,
    minWeight: Math.min(...weights),
    maxWeight: Math.max(...weights),
    totalEntries: entries.length,
    firstDate: sorted[0].date,
    ratePerWeek: calculateRatePerWeek(last30),
  };
}

// ── Goal-Aware Status Logic ─────────────────────────────────────────

/** Determine weight tracking status based on goal mode and recent trend.
 *  Returns a status enum + human-readable insight text. */
export function determineWeightStatus(
  entries: WeightEntry[],
  goalMode: GoalMode,
  goalWeight: number,
): WeightInsight {
  const sorted = sortByDate(entries);

  if (sorted.length < MIN_ENTRIES_FOR_TREND) {
    return {
      status: 'insufficient_data',
      title: 'Keep logging',
      message: `Log at least ${MIN_ENTRIES_FOR_TREND} weigh-ins to see your trend.`,
    };
  }

  const last30 = filterByDays(sorted, 30);
  const rate = calculateRatePerWeek(sortByDate(last30));

  if (rate === null) {
    return {
      status: 'insufficient_data',
      title: 'More data needed',
      message: 'Log weight over at least a week for trend analysis.',
    };
  }

  const absRate = Math.abs(rate);
  const current = sorted[sorted.length - 1].weight_kg;
  const atGoal = Math.abs(current - goalWeight) < AT_GOAL_TOLERANCE_KG;

  switch (goalMode) {
    case 'fat_loss': {
      if (atGoal) {
        return { status: 'on_track', title: 'Goal reached!', message: `You're at your goal weight of ${goalWeight} kg.` };
      }
      if (rate < -PLATEAU_THRESHOLD_KG_PER_WEEK) {
        const toGo = current > goalWeight ? `${(current - goalWeight).toFixed(1)} kg to goal.` : 'Keep it up!';
        return { status: 'on_track', title: 'On track', message: `Losing ${absRate.toFixed(1)} kg/week. ${toGo}` };
      }
      if (absRate <= PLATEAU_THRESHOLD_KG_PER_WEEK) {
        return { status: 'plateau', title: 'Plateau', message: 'Weight is stable. Consider adjusting calories or increasing activity.' };
      }
      return { status: 'wrong_direction', title: 'Gaining weight', message: `Gaining ${absRate.toFixed(1)} kg/week during fat loss phase. Review your intake.` };
    }

    case 'muscle_gain': {
      if (rate > PLATEAU_THRESHOLD_KG_PER_WEEK && rate <= FAST_GAIN_THRESHOLD_KG_PER_WEEK) {
        return { status: 'on_track', title: 'On track', message: `Gaining ${absRate.toFixed(1)} kg/week — good pace for lean gains.` };
      }
      if (rate > FAST_GAIN_THRESHOLD_KG_PER_WEEK) {
        return { status: 'wrong_direction', title: 'Gaining too fast', message: `${absRate.toFixed(1)} kg/week is fast — risk of excess fat gain. Reduce surplus slightly.` };
      }
      if (absRate <= PLATEAU_THRESHOLD_KG_PER_WEEK) {
        return { status: 'plateau', title: 'Plateau', message: 'Weight is stable. Consider increasing calories slightly for growth.' };
      }
      return { status: 'wrong_direction', title: 'Losing weight', message: 'Weight decreasing during muscle gain phase. Increase calorie intake.' };
    }

    case 'maintenance': {
      if (absRate <= PLATEAU_THRESHOLD_KG_PER_WEEK) {
        return { status: 'on_track', title: 'Stable', message: 'Weight is stable — well maintained.' };
      }
      if (absRate <= MAINTENANCE_DRIFT_THRESHOLD_KG_PER_WEEK) {
        return { status: 'plateau', title: 'Minor drift', message: `${rate > 0 ? 'Slight gain' : 'Slight loss'} of ${absRate.toFixed(1)} kg/week. Monitor closely.` };
      }
      return {
        status: 'wrong_direction',
        title: rate > 0 ? 'Gaining' : 'Losing',
        message: `${absRate.toFixed(1)} kg/week change. Adjust intake to maintain.`,
      };
    }

    case 'endurance':
    case 'strength': {
      if (absRate <= MAINTENANCE_DRIFT_THRESHOLD_KG_PER_WEEK) {
        return { status: 'on_track', title: 'Stable', message: 'Weight is stable — good for performance goals.' };
      }
      return {
        status: rate > 0 ? 'plateau' : 'wrong_direction',
        title: rate > 0 ? 'Gaining slightly' : 'Losing weight',
        message: `${absRate.toFixed(1)} kg/week change. Monitor how this affects your performance.`,
      };
    }

    default:
      return { status: 'insufficient_data', title: 'Unknown goal', message: 'Set a goal mode in your profile.' };
  }
}

// ── Export Readiness ────────────────────────────────────────────────

/** Format weight entries as CSV string for export.
 *  Architecture is ready for share sheet / file export in a future version. */
export function exportWeightCSV(entries: WeightEntry[]): string {
  const sorted = sortByDate(entries);
  const header = 'date,weight_kg,created_at,updated_at';
  const rows = sorted.map(e =>
    `${e.date},${e.weight_kg},${new Date(e.created_at).toISOString()},${new Date(e.updated_at).toISOString()}`
  );
  return [header, ...rows].join('\n');
}
