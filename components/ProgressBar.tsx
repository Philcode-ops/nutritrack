import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontSize } from '../constants/theme';

interface Props {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ label, current, goal, color, unit = '', showPercentage }: Props) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  const displayCurrent = Math.round(current);
  const displayGoal = Math.round(goal);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {displayCurrent}{unit} / {displayGoal}{unit}
          {showPercentage && ` (${Math.round(pct * 100)}%)`}
        </Text>
      </View>
      <View style={styles.trackOuter}>
        <View style={[styles.trackFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  value: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  trackOuter: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 5,
  },
});
