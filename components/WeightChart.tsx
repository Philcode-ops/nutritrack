import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { WeightEntry, dateToTimestamp, formatDisplayDate } from '../constants/weight';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';

// ── Chart Configuration ─────────────────────────────────────────────

const CHART_HEIGHT = 200;
const PADDING = { left: 48, right: 16, top: 24, bottom: 28 };
const DOT_RADIUS = 5;
const RAW_LINE_THICKNESS = 1.5;
const RAW_LINE_OPACITY = 0.35;
const TREND_LINE_THICKNESS = 2.5;
const GRID_LINE_COUNT = 5;
const X_LABEL_COUNT = 4;
const MIN_Y_RANGE_KG = 4; // Minimum kg spread so chart isn't flat

// ── Sub-components ──────────────────────────────────────────────────

function LineSegment({
  x1, y1, x2, y2, color, thickness, opacity = 1,
}: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; thickness: number; opacity?: number;
}) {
  // Guard against any non-finite input — NaN/Infinity in a style's width or
  // in the transform rotate string crashes RN's native layout with
  // "Invalid array length".
  if (![x1, y1, x2, y2, thickness].every(Number.isFinite)) return null;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(length) || length < 0.5) return null;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (!Number.isFinite(angle)) return null;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: midX - length / 2,
        top: midY - thickness / 2,
        width: length,
        height: thickness,
        backgroundColor: color,
        borderRadius: thickness / 2,
        opacity,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

function DashedHorizontalLine({ y, width, color }: { y: number; width: number; color: string }) {
  if (!Number.isFinite(y) || !Number.isFinite(width) || width <= 0) return null;
  const safeWidth = Math.min(width, 10000);            // hard cap to prevent runaway loops
  const dashWidth = 6;
  const gapWidth = 4;
  const dashes = [];
  for (let x = 0; x < safeWidth; x += dashWidth + gapWidth) {
    dashes.push(
      <View
        key={x}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: Math.max(0, Math.min(dashWidth, safeWidth - x)),
          height: 1.5,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />,
    );
  }
  return <>{dashes}</>;
}

// ── Y-axis range calculation ────────────────────────────────────────

function calculateYRange(weights: number[], goalWeight: number | null): { yMin: number; yMax: number } {
  // Only keep finite values — defend against NaN goalWeight or corrupt entries
  const finiteWeights = weights.filter(Number.isFinite);
  const finiteGoal = goalWeight != null && Number.isFinite(goalWeight) ? goalWeight : null;
  const allValues = finiteGoal != null ? [...finiteWeights, finiteGoal] : finiteWeights;
  if (allValues.length === 0) return { yMin: 70, yMax: 80 };

  // Use reduce instead of spread to avoid edge-cases with very large arrays
  let min = allValues[0];
  let max = allValues[0];
  for (const v of allValues) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // Ensure minimum range
  const range = max - min;
  if (range < MIN_Y_RANGE_KG) {
    const mid = (min + max) / 2;
    min = mid - MIN_Y_RANGE_KG / 2;
    max = mid + MIN_Y_RANGE_KG / 2;
  }

  // Add 10% padding
  const padding = (max - min) * 0.1;
  min -= padding;
  max += padding;

  // Round to nearest 0.5
  min = Math.floor(min * 2) / 2;
  max = Math.ceil(max * 2) / 2;

  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return { yMin: 70, yMax: 80 };
  }

  return { yMin: min, yMax: max };
}

// ── Main Chart Component ────────────────────────────────────────────

interface WeightChartProps {
  entries: WeightEntry[];
  trendValues: number[];
  goalWeight: number | null;
}

export function WeightChart({ entries, trendValues, goalWeight }: WeightChartProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const plotWidth = containerWidth - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const chartData = useMemo(() => {
    // Hard-gate: need entries, a measured container, and positive plot space
    if (!Array.isArray(entries) || entries.length === 0) return null;
    if (containerWidth === 0 || plotWidth <= 0 || plotHeight <= 0) return null;

    // Filter to entries with finite weight and valid date — everything downstream
    // assumes numbers it can safely subtract/divide
    const safeEntries = entries.filter(e => {
      const w = Number(e.weight_kg);
      const t = dateToTimestamp(e.date);
      return Number.isFinite(w) && Number.isFinite(t);
    });
    if (safeEntries.length === 0) return null;

    const safeGoal = goalWeight != null && Number.isFinite(goalWeight) ? goalWeight : null;
    const weights = safeEntries.map(e => e.weight_kg);
    const { yMin, yMax } = calculateYRange(weights, safeGoal);
    const yRange = yMax - yMin;
    if (!Number.isFinite(yRange) || yRange <= 0) return null;

    // Map entries to pixel coordinates
    const timestamps = safeEntries.map(e => dateToTimestamp(e.date));
    const tMin = timestamps[0];
    const tMax = timestamps[timestamps.length - 1];
    const tRange = tMax - tMin;

    const points = safeEntries.map((entry, i) => {
      // For single entry or zero time-range, center it
      const xFrac = Number.isFinite(tRange) && tRange > 0 ? (timestamps[i] - tMin) / tRange : 0.5;
      const yFrac = (entry.weight_kg - yMin) / yRange;
      return {
        x: PADDING.left + xFrac * plotWidth,
        y: PADDING.top + (1 - yFrac) * plotHeight, // Invert Y (screen coords)
        weight: entry.weight_kg,
        date: entry.date,
      };
    }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

    if (points.length === 0) return null;

    // Trend line points — line up by index with safeEntries, then drop any non-finite coords
    const trendPoints = trendValues.map((val, i) => {
      if (i >= points.length) return null;
      if (!Number.isFinite(val)) return null;
      const yFrac = (val - yMin) / yRange;
      const y = PADDING.top + (1 - yFrac) * plotHeight;
      if (!Number.isFinite(y)) return null;
      return { x: points[i].x, y };
    }).filter(Boolean) as { x: number; y: number }[];

    // Goal line Y position — null if it doesn't produce a finite pixel value
    let goalY: number | null = null;
    if (safeGoal != null) {
      const candidate = PADDING.top + (1 - (safeGoal - yMin) / yRange) * plotHeight;
      if (Number.isFinite(candidate)) goalY = candidate;
    }

    // Y-axis grid values
    const gridValues: number[] = [];
    for (let i = 0; i < GRID_LINE_COUNT; i++) {
      const val = yMin + (yRange * i) / (GRID_LINE_COUNT - 1);
      if (Number.isFinite(val)) gridValues.push(Math.round(val * 10) / 10);
    }

    // X-axis labels (pick evenly spaced dates). Use `points.length` (post-filter)
    // rather than `entries.length` so indices can never overshoot.
    const xLabels: { x: number; label: string }[] = [];
    const labelCount = Math.min(X_LABEL_COUNT, points.length);
    if (points.length <= X_LABEL_COUNT) {
      points.forEach((p, i) => {
        xLabels.push({ x: p.x, label: formatDisplayDate(safeEntries[i].date) });
      });
    } else {
      for (let i = 0; i < labelCount; i++) {
        const idx = Math.round((i / Math.max(1, labelCount - 1)) * (points.length - 1));
        const clampedIdx = Math.min(Math.max(idx, 0), points.length - 1);
        xLabels.push({ x: points[clampedIdx].x, label: formatDisplayDate(safeEntries[clampedIdx].date) });
      }
    }

    return { points, trendPoints, goalY, gridValues, xLabels, yMin, yMax, yRange };
  }, [entries, trendValues, goalWeight, containerWidth, plotWidth, plotHeight]);

  if (entries.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]} onLayout={onLayout}>
        <Text style={styles.emptyText}>Log your weight to see the chart</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      {containerWidth > 0 && chartData && (
        <View style={{ height: CHART_HEIGHT }}>
          {/* Y-axis grid lines and labels */}
          {chartData.gridValues.map((val, i) => {
            const yFrac = (val - chartData.yMin) / chartData.yRange;
            const y = PADDING.top + (1 - yFrac) * plotHeight;
            return (
              <React.Fragment key={`grid-${i}`}>
                <View
                  style={[
                    styles.gridLine,
                    { top: y, left: PADDING.left, width: plotWidth },
                  ]}
                />
                <Text style={[styles.yLabel, { top: y - 7, left: 0 }]}>
                  {val.toFixed(1)}
                </Text>
              </React.Fragment>
            );
          })}

          {/* Goal line */}
          {chartData.goalY != null && chartData.goalY >= PADDING.top && chartData.goalY <= PADDING.top + plotHeight && (
            <>
              <DashedHorizontalLine
                y={chartData.goalY}
                width={plotWidth}
                color={Colors.accent}
              />
              <Text style={[styles.goalLabel, { top: chartData.goalY - 14, left: PADDING.left }]}>
                Goal
              </Text>
            </>
          )}

          {/* Raw data line (thin + translucent, drawn FIRST so trend overlays it) */}
          {chartData.points.map((pt, i) => {
            if (i === 0) return null;
            const prev = chartData.points[i - 1];
            return (
              <LineSegment
                key={`raw-${i}`}
                x1={prev.x} y1={prev.y}
                x2={pt.x} y2={pt.y}
                color={Colors.primary}
                thickness={RAW_LINE_THICKNESS}
                opacity={RAW_LINE_OPACITY}
              />
            );
          })}

          {/* Trend line (thicker, full opacity, drawn ON TOP of raw) */}
          {chartData.trendPoints.map((pt, i) => {
            if (i === 0) return null;
            const prev = chartData.trendPoints[i - 1];
            return (
              <LineSegment
                key={`trend-${i}`}
                x1={prev.x} y1={prev.y}
                x2={pt.x} y2={pt.y}
                color={Colors.protein}
                thickness={TREND_LINE_THICKNESS}
              />
            );
          })}

          {/* Data dots (drawn LAST so they sit on top of every line) */}
          {chartData.points.map((pt, i) => (
            <View
              key={`dot-${i}`}
              style={[
                styles.dot,
                {
                  left: pt.x - DOT_RADIUS,
                  top: pt.y - DOT_RADIUS,
                  width: DOT_RADIUS * 2,
                  height: DOT_RADIUS * 2,
                  borderRadius: DOT_RADIUS,
                },
              ]}
            />
          ))}

          {/* X-axis labels */}
          {chartData.xLabels.map((lbl, i) => (
            <Text
              key={`xlabel-${i}`}
              style={[styles.xLabel, { left: lbl.x - 24, top: CHART_HEIGHT - 16 }]}
              numberOfLines={1}
            >
              {lbl.label}
            </Text>
          ))}

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Weight</Text>
            </View>
            {trendValues.length > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: Colors.protein }]} />
                <Text style={styles.legendText}>Trend</Text>
              </View>
            )}
            {goalWeight != null && (
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: Colors.accent }]} />
                <Text style={styles.legendText}>Goal</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    minHeight: CHART_HEIGHT,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.5,
  },
  yLabel: {
    position: 'absolute',
    fontSize: 10,
    color: Colors.textSecondary,
    width: PADDING.left - 4,
    textAlign: 'right',
  },
  xLabel: {
    position: 'absolute',
    fontSize: 10,
    color: Colors.textSecondary,
    width: 48,
    textAlign: 'center',
  },
  goalLabel: {
    position: 'absolute',
    fontSize: 10,
    color: Colors.accent,
    fontWeight: '600',
  },
  dot: {
    position: 'absolute',
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  legend: {
    position: 'absolute',
    top: 2,
    right: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
});
