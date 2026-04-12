import { useMemo, useCallback } from 'react';
import { useStorage } from './useStorage';
import { generateId } from './generateId';
import {
  WeightEntry,
  WeightSummary,
  WeightInsight,
  TimeRange,
  sortByDate,
  filterByDays,
  calculateEWMA,
  computeWeightSummary,
  determineWeightStatus,
  getTodayKey,
  TIME_RANGE_DAYS,
} from '../constants/weight';
import { GoalMode } from '../constants/nutrition';

export function useWeightLog() {
  const [entries, setEntries, loaded] = useStorage<WeightEntry[]>('weight_log_v1', []);

  const sortedEntries = useMemo(() => sortByDate(entries), [entries]);

  const latestEntry = useMemo(
    () => sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : null,
    [sortedEntries],
  );

  /** Add or update a weight entry. One entry per date — replaces on conflict.
   *  Profile `currentWeight` sync is handled at the screen level via a useEffect
   *  watching `latestEntry`, so CRUD here is a pure state update. */
  const addOrUpdateEntry = useCallback(
    (date: string, weight_kg: number): void => {
      const now = Date.now();
      setEntries((prev) => {
        const existingIdx = prev.findIndex(e => e.date === date);
        if (existingIdx >= 0) {
          return prev.map((e, i) =>
            i === existingIdx ? { ...e, weight_kg, updated_at: now } : e,
          );
        }
        return [
          ...prev,
          { id: generateId(), date, weight_kg, created_at: now, updated_at: now },
        ];
      });
    },
    [setEntries],
  );

  /** Remove a weight entry by ID */
  const removeEntry = useCallback(
    (id: string) => {
      setEntries(prev => prev.filter(e => e.id !== id));
    },
    [setEntries],
  );

  /** Get sorted entries filtered to a time range */
  const getEntriesForRange = useCallback(
    (range: TimeRange): WeightEntry[] => {
      const days = TIME_RANGE_DAYS[range];
      return sortByDate(filterByDays(sortedEntries, days));
    },
    [sortedEntries],
  );

  /** Get EWMA trend values for a time range */
  const getTrendForRange = useCallback(
    (range: TimeRange): number[] => {
      return calculateEWMA(getEntriesForRange(range));
    },
    [getEntriesForRange],
  );

  /** Full summary metrics */
  const summary: WeightSummary = useMemo(
    () => computeWeightSummary(entries),
    [entries],
  );

  /** Goal-aware insight */
  const getInsight = useCallback(
    (goalMode: GoalMode, goalWeight: number): WeightInsight => {
      return determineWeightStatus(entries, goalMode, goalWeight);
    },
    [entries],
  );

  /** Check if an entry exists for a specific date */
  const getEntryForDate = useCallback(
    (date: string): WeightEntry | null => {
      return entries.find(e => e.date === date) ?? null;
    },
    [entries],
  );

  const todayEntry = useMemo(
    () => entries.find(e => e.date === getTodayKey()) ?? null,
    [entries],
  );

  return {
    entries: sortedEntries,
    loaded,
    latestEntry,
    todayEntry,
    summary,
    addOrUpdateEntry,
    removeEntry,
    getEntriesForRange,
    getTrendForRange,
    getInsight,
    getEntryForDate,
  };
}
