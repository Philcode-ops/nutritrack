import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWeightLog } from '../../hooks/useWeightLog';
import { useNutritionContext } from '../../components/NutritionContext';
import { WeightChart } from '../../components/WeightChart';
import { DatePickerModal } from '../../components/DatePickerModal';
import {
  TimeRange,
  WeightStatus,
  getTodayKey,
  getRelativeDateLabel,
  shiftDate,
  formatDisplayDate,
} from '../../constants/weight';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const TIME_RANGES: TimeRange[] = ['1W', '1M', '3M', '1Y', 'ALL'];

const STATUS_CONFIG: Record<WeightStatus, { icon: string; color: string }> = {
  on_track: { icon: 'checkmark-circle', color: Colors.primary },
  plateau: { icon: 'pause-circle', color: Colors.accent },
  wrong_direction: { icon: 'alert-circle', color: Colors.error },
  insufficient_data: { icon: 'time-outline', color: Colors.textSecondary },
};

// ── Input sanitization: numeric with at most one decimal place ──────

function sanitizeWeightInput(text: string): string {
  // Accept comma as decimal separator (common in EU locales)
  let cleaned = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    // Strip any additional dots and cap decimal part to 1 digit
    cleaned = cleaned.substring(0, firstDot + 1)
      + cleaned.substring(firstDot + 1).replace(/\./g, '').substring(0, 1);
  }
  // Cap integer part to 3 digits (max 999 kg)
  const [intPart, decPart] = cleaned.split('.');
  const capped = intPart.substring(0, 3);
  return decPart !== undefined ? `${capped}.${decPart}` : capped;
}

export default function WeightScreen() {
  const {
    entries, latestEntry, summary, loaded,
    addOrUpdateEntry, removeEntry, getEntriesForRange, getTrendForRange, getInsight,
  } = useWeightLog();
  const { profile, setProfile } = useNutritionContext();

  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [weightInput, setWeightInput] = useState('');
  const [range, setRange] = useState<TimeRange>('1M');
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // ── Profile sync: keep currentWeight aligned with LATEST entry by date ──
  // Runs on every create / update / delete because latestEntry changes.
  // - New entry that becomes the latest → profile updates
  // - Backfilled older entry → latestEntry unchanged → profile NOT updated
  // - Edit to latest entry → latestEntry.weight_kg changes → profile updates
  // - Delete of latest entry → latestEntry becomes previous-latest → profile updates
  // - Delete of older entry → latestEntry unchanged → profile NOT updated
  useEffect(() => {
    if (!latestEntry) return;
    setProfile((prev) => {
      if (Math.abs(prev.currentWeight - latestEntry.weight_kg) < 0.05) return prev;
      return { ...prev, currentWeight: latestEntry.weight_kg };
    });
  }, [latestEntry, setProfile]);

  // ── Input sync: pre-fill draft state when SELECTED DATE changes ──
  // Intentionally depends only on selectedDate so the user's in-progress
  // typing is never clobbered by entry/profile state updates.
  const syncedForDateRef = useRef<string>('');
  useEffect(() => {
    if (!loaded) return;
    if (syncedForDateRef.current === selectedDate) return;
    syncedForDateRef.current = selectedDate;

    const existing = entries.find(e => e.date === selectedDate);
    const value = existing
      ? String(existing.weight_kg)
      : latestEntry
        ? String(latestEntry.weight_kg)
        : profile.currentWeight > 0 ? String(profile.currentWeight) : '';
    setWeightInput(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, loaded]);

  const existingEntry = useMemo(
    () => entries.find(e => e.date === selectedDate) ?? null,
    [entries, selectedDate],
  );

  const todayKey = getTodayKey();
  const canGoForward = selectedDate < todayKey;

  const handleDateBack = () => setSelectedDate(prev => shiftDate(prev, -1));
  const handleDateForward = () => {
    if (canGoForward) setSelectedDate(prev => shiftDate(prev, 1));
  };

  const handleLogWeight = useCallback(() => {
    const value = parseFloat(weightInput);
    if (isNaN(value) || value < 20 || value > 400) {
      Alert.alert('Invalid weight', 'Please enter a weight between 20 and 400 kg.');
      return;
    }
    const rounded = Math.round(value * 10) / 10;
    addOrUpdateEntry(selectedDate, rounded);
    // Keep the saved value visible in the field (no forced clear).
    setWeightInput(String(rounded));
    // Profile sync handled by the useEffect watching latestEntry.
  }, [weightInput, selectedDate, addOrUpdateEntry]);

  const handleDeleteEntry = (id: string, date: string) => {
    Alert.alert(
      'Delete Entry',
      `Remove weight entry for ${formatDisplayDate(date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeEntry(id) },
      ],
    );
  };

  const chartEntries = useMemo(() => getEntriesForRange(range), [getEntriesForRange, range]);
  const trendValues = useMemo(() => getTrendForRange(range), [getTrendForRange, range]);

  const insight = useMemo(
    () => getInsight(profile.goalMode, profile.goalWeight),
    [getInsight, profile.goalMode, profile.goalWeight],
  );
  const statusCfg = STATUS_CONFIG[insight.status];

  const recentEntries = useMemo(
    () => [...entries].reverse().slice(0, 20),
    [entries],
  );

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Log Weight Card ──────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Log Weight</Text>

          {/* Date selector: arrows + tappable date label */}
          <View style={styles.dateRow}>
            <TouchableOpacity onPress={handleDateBack} style={styles.dateArrow}>
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateLabelBtn}
              onPress={() => setDatePickerVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              <Text style={styles.dateText}>{getRelativeDateLabel(selectedDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDateForward}
              style={styles.dateArrow}
              disabled={!canGoForward}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={canGoForward ? Colors.primary : Colors.border}
              />
            </TouchableOpacity>
          </View>

          {existingEntry && (
            <Text style={styles.existingNote}>
              Logged: {existingEntry.weight_kg.toFixed(1)} kg — saving will update it
            </Text>
          )}

          {/* Weight input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.weightInput}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={Colors.textSecondary}
              value={weightInput}
              onChangeText={(t) => setWeightInput(sanitizeWeightInput(t))}
              onSubmitEditing={handleLogWeight}
              returnKeyType="done"
              selectTextOnFocus
              maxLength={6}
            />
            <Text style={styles.unitLabel}>kg</Text>
            <TouchableOpacity style={styles.logBtn} onPress={handleLogWeight}>
              <Ionicons name="checkmark" size={20} color={Colors.textLight} />
              <Text style={styles.logBtnText}>
                {existingEntry ? 'Update' : 'Log'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Chart Card ──────────────────────── */}
        <View style={styles.card}>
          <View style={styles.rangeRow}>
            {TIME_RANGES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
                onPress={() => setRange(r)}
              >
                <Text style={[styles.rangeBtnText, range === r && styles.rangeBtnTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <WeightChart
            entries={chartEntries}
            trendValues={trendValues}
            goalWeight={profile.goalWeight}
          />
        </View>

        {/* ── Summary Cards ───────────────────── */}
        {entries.length > 0 && (
          <View style={styles.summaryRow}>
            <SummaryCard label="7 days" value={summary.change7d} goalDelta={profile.goalWeight - (summary.current ?? 0)} />
            <SummaryCard label="30 days" value={summary.change30d} goalDelta={profile.goalWeight - (summary.current ?? 0)} />
            <SummaryCard label="per week" value={summary.ratePerWeek} goalDelta={profile.goalWeight - (summary.current ?? 0)} suffix="/wk" />
          </View>
        )}

        {/* ── Insight Card ────────────────────── */}
        {entries.length > 0 && (
          <View style={[styles.card, styles.insightCard, { borderLeftColor: statusCfg.color }]}>
            <View style={styles.insightHeader}>
              <Ionicons name={statusCfg.icon as any} size={24} color={statusCfg.color} />
              <Text style={[styles.insightTitle, { color: statusCfg.color }]}>
                {insight.title}
              </Text>
            </View>
            <Text style={styles.insightMessage}>{insight.message}</Text>
          </View>
        )}

        {/* ── Progress to Goal ────────────────── */}
        {summary.current != null && profile.goalWeight > 0 && summary.startWeight != null && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Progress to Goal</Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>{summary.startWeight.toFixed(1)} kg</Text>
              <View style={styles.progressBarOuter}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(Math.max(getGoalProgress(summary.startWeight, summary.current, profile.goalWeight), 0), 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>{profile.goalWeight.toFixed(1)} kg</Text>
            </View>
            <Text style={styles.progressCurrent}>
              Current: {summary.current.toFixed(1)} kg
              {summary.current !== summary.startWeight && (
                ` (${summary.current < summary.startWeight ? '' : '+'}${(summary.current - summary.startWeight).toFixed(1)} kg)`
              )}
            </Text>
          </View>
        )}

        {/* ── History ─────────────────────────── */}
        {recentEntries.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              History ({summary.totalEntries} entries)
            </Text>
            {recentEntries.map((entry, idx) => {
              const prev = idx < recentEntries.length - 1 ? recentEntries[idx + 1] : null;
              const diff = prev ? entry.weight_kg - prev.weight_kg : null;
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.historyRow}
                  onPress={() => setSelectedDate(entry.date)}
                  activeOpacity={0.6}
                >
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyDate}>
                      {getRelativeDateLabel(entry.date)}
                    </Text>
                    <Text style={styles.historyWeight}>
                      {entry.weight_kg.toFixed(1)} kg
                    </Text>
                  </View>
                  {diff !== null && (
                    <Text
                      style={[
                        styles.historyDiff,
                        { color: diff === 0 ? Colors.textSecondary : diff < 0 ? Colors.primary : Colors.accent },
                      ]}
                    >
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDeleteEntry(entry.id, entry.date)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Empty State ─────────────────────── */}
        {entries.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trending-up-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>Track Your Weight</Text>
            <Text style={styles.emptySubtitle}>
              Log your weight regularly to see trends, get insights, and track progress toward your goal.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date picker modal */}
      <DatePickerModal
        visible={datePickerVisible}
        selectedDate={selectedDate}
        onClose={() => setDatePickerVisible(false)}
        onSelect={setSelectedDate}
        maxDate={todayKey}
      />
    </SafeAreaView>
  );
}

// ── Helper Components ───────────────────────────────────────────────

/** Summary card — color is determined by whether the change moves TOWARD the goal.
 *  Uses goalDelta (goalWeight - current) so sign is meaningful:
 *    goalDelta > 0 → user needs to gain → positive change is good
 *    goalDelta < 0 → user needs to lose → negative change is good
 *    goalDelta ≈ 0 → user wants to maintain → small magnitude is good */
function SummaryCard({
  label, value, goalDelta, suffix = '',
}: {
  label: string; value: number | null; goalDelta: number; suffix?: string;
}) {
  const displayValue = value != null ? `${value > 0 ? '+' : ''}${value.toFixed(1)}` : '—';

  let color = Colors.textSecondary;
  if (value != null) {
    const NEAR_GOAL = 1.0;
    if (Math.abs(goalDelta) < NEAR_GOAL) {
      // Maintain: small change is good, large change is bad
      color = Math.abs(value) < 0.3 ? Colors.primary : Colors.accent;
    } else if (goalDelta > 0) {
      // Need to gain: positive is good, flat is neutral, negative is bad
      if (value > 0.1) color = Colors.primary;
      else if (value < -0.1) color = Colors.error;
      else color = Colors.accent;
    } else {
      // Need to lose: negative is good, flat is neutral, positive is bad
      if (value < -0.1) color = Colors.primary;
      else if (value > 0.1) color = Colors.error;
      else color = Colors.accent;
    }
  }

  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color }]}>
        {displayValue}{value != null ? ` kg${suffix}` : ''}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function getGoalProgress(start: number, current: number, goal: number): number {
  const totalDistance = Math.abs(goal - start);
  if (totalDistance < 0.1) return 100;
  const progress = Math.abs(current - start);
  return (progress / totalDistance) * 100;
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md,
  },

  // Date selector
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  dateArrow: { padding: Spacing.sm },
  dateLabelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.sm,
    minWidth: 140, justifyContent: 'center',
  },
  dateText: {
    fontSize: FontSize.md, fontWeight: '700', color: Colors.primaryDark,
    textAlign: 'center',
  },
  existingNote: {
    fontSize: FontSize.xs, color: Colors.accent, fontStyle: 'italic',
    textAlign: 'center', marginBottom: Spacing.sm,
  },

  // Weight input
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  weightInput: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, textAlign: 'center',
  },
  unitLabel: {
    fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '600',
  },
  logBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
  },
  logBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textLight },

  // Range selector
  rangeRow: {
    flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md,
  },
  rangeBtn: {
    flex: 1, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.sm,
    alignItems: 'center', backgroundColor: Colors.background,
  },
  rangeBtnActive: { backgroundColor: Colors.primary },
  rangeBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  rangeBtnTextActive: { color: Colors.textLight },

  // Summary
  summaryRow: {
    flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md,
  },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  summaryValue: { fontSize: FontSize.sm, fontWeight: '700' },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Insight
  insightCard: { borderLeftWidth: 4 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  insightTitle: { fontSize: FontSize.md, fontWeight: '700' },
  insightMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Progress
  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, width: 48, textAlign: 'center' },
  progressBarOuter: {
    flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.border, overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%', borderRadius: 5, backgroundColor: Colors.primary,
  },
  progressCurrent: {
    fontSize: FontSize.sm, color: Colors.text, textAlign: 'center', fontWeight: '600',
  },

  // History
  historyRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  historyInfo: { flex: 1 },
  historyDate: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  historyWeight: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  historyDiff: { fontSize: FontSize.sm, fontWeight: '600', marginRight: Spacing.md, minWidth: 52, textAlign: 'right' },

  // Empty
  emptyState: {
    alignItems: 'center', paddingVertical: Spacing.xl * 2, paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center',
    marginTop: Spacing.sm, lineHeight: 20,
  },
});
