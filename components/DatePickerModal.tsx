import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { getTodayKey, parseDateKey } from '../constants/weight';

// ─────────────────────────────────────────────────────────────────────
// A compact calendar picker for fast historical date selection.
// No external date-picker library required — all pure RN.
// ─────────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];  // Sunday start
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  visible: boolean;
  selectedDate: string;               // YYYY-MM-DD
  onClose: () => void;
  onSelect: (date: string) => void;
  /** Upper bound (inclusive). Defaults to today — can't pick future dates. */
  maxDate?: string;
  /** Lower bound (inclusive). */
  minDate?: string;
}

function parseYearMonth(dateStr: string): { y: number; m: number } {
  const parsed = parseDateKey(dateStr);
  if (parsed) return { y: parsed.y, m: parsed.m - 1 };
  // Fallback to today if input is malformed — prevents NaN viewYear/viewMonth
  // propagating into loop bounds and native Date construction.
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() };
}

export function DatePickerModal({
  visible, selectedDate, onClose, onSelect, maxDate, minDate,
}: Props) {
  const today = getTodayKey();
  const effectiveMax = maxDate ?? today;

  const [viewYear, setViewYear] = useState(() => parseYearMonth(selectedDate).y);
  const [viewMonth, setViewMonth] = useState(() => parseYearMonth(selectedDate).m);

  // Re-sync the visible month to the selected date every time the modal opens
  useEffect(() => {
    if (visible) {
      const { y, m } = parseYearMonth(selectedDate);
      setViewYear(y);
      setViewMonth(m);
    }
  }, [visible, selectedDate]);

  // Build the day grid for the currently-viewed month. Defend against any
  // non-finite viewYear/viewMonth slipping in — Date(NaN,…) produces NaN day
  // counts which could otherwise feed malformed loops.
  const safeYear = Number.isFinite(viewYear) ? Math.trunc(viewYear) : new Date().getFullYear();
  const safeMonth = Number.isFinite(viewMonth) ? Math.min(Math.max(Math.trunc(viewMonth), 0), 11) : new Date().getMonth();

  const rawDaysInMonth = new Date(safeYear, safeMonth + 1, 0).getDate();
  const rawFirstWeekday = new Date(safeYear, safeMonth, 1).getDay();
  const daysInMonth = Number.isFinite(rawDaysInMonth) && rawDaysInMonth > 0 ? rawDaysInMonth : 30;
  const firstWeekday = Number.isFinite(rawFirstWeekday) ? Math.min(Math.max(rawFirstWeekday, 0), 6) : 0;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0 && cells.length < 42) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const shiftMonth = (delta: number) => {
    let y = viewYear;
    let m = viewMonth + delta;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  };

  const cellDateStr = (day: number) =>
    `${safeYear}-${String(safeMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isDisabled = (day: number): boolean => {
    const d = cellDateStr(day);
    if (d > effectiveMax) return true;
    if (minDate != null && d < minDate) return true;
    return false;
  };

  const handleSelectDay = (day: number) => {
    if (isDisabled(day)) return;
    onSelect(cellDateStr(day));
    onClose();
  };

  const handleJumpToToday = () => {
    const { y, m } = parseYearMonth(today);
    setViewYear(y);
    setViewMonth(m);
    onSelect(today);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Date</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Year navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => setViewYear(viewYear - 1)} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.yearText}>{safeYear}</Text>
            <TouchableOpacity onPress={() => setViewYear(viewYear + 1)} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Month navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthText}>{MONTH_NAMES[safeMonth]}</Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={styles.dayCell}>
                <Text style={styles.weekdayLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          {weeks.map((week, i) => (
            <View key={i} style={styles.weekRow}>
              {week.map((day, j) => {
                if (day === null) {
                  return <View key={j} style={styles.dayCell} />;
                }
                const dateStr = cellDateStr(day);
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === today;
                const disabled = isDisabled(day);

                return (
                  <TouchableOpacity
                    key={j}
                    style={[
                      styles.dayCell,
                      isToday && !isSelected && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => handleSelectDay(day)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isToday && !isSelected && styles.dayTextToday,
                        isSelected && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleJumpToToday}>
              <Ionicons name="today-outline" size={16} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnCancel]} onPress={onClose}>
              <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const CELL_SIZE = 38;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  navBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  yearText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    minWidth: 60,
    textAlign: 'center',
  },
  monthText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 140,
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL_SIZE / 2,
    margin: 1,
  },
  dayCellToday: {
    backgroundColor: Colors.primaryLight,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  weekdayLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  dayText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  dayTextToday: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: Colors.textLight,
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: Colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  actionBtnCancel: {},
  actionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
