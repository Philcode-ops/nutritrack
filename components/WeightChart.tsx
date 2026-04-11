import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { WeightEntry, dateToTimestamp, formatDisplayDate } from '../constants/weight';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';

// ── Chart Configuration ─────────────────────────────────────────────

const CHART_HEIGHT = 200;
const PADDING = { left: 48, right: 16, top: 16, bottom: 28 };
const DOT_RADIUS = 4;
const LINE_THICKNESS = 2;
const TREND_LINE_THICKNESS = 1.5;
const GRID_LINE_COUNT = 5;
const X_LABEL_COUNT = 4;
const MIN_Y_RANGE_KG = 4; // Minimum kg spread so chart isn't flat

// ── Sub-components ──────────────────────────────────────────────────

function LineSegment({
  x1, y1, x2, y2, color, thickness,
}: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; thickness: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.5) return null;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
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
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

function DashedHorizontalLine({ y, width, color }: { y: number; width: number; color: string }) {
  const dashWidth = 6;
  const gapWidth = 4;
  const dashes = [];
  for (let x = 0; x < width; x += dashWidth + gapWidth) {
    dashes.push(
      <View
        key={x}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: Math.min(dashWidth, width - x),
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
  const allValues = goalWeight != null ? [...weights, goalWeight] : [...weights];
  if (allValues.length === 0) return { yMin: 70, yMax: 80 };

  let min = Math.min(...allValues);
  let max = Math.max(...allValues);

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
    if (entries.length === 0 || containerWidth === 0) return null;

    const weights = entries.map(e => e.weight_kg);
    const { yMin, yMax } = calculateYRange(weights, goalWeight);
    const yRange = yMax - yMin;

    // Map entries to pixel coordinates
    const timestamps = entries.map(e => dateToTimestamp(e.date));
    const tMin = timestamps[0];
    const tMax = timestamps[timestamps.length - 1];
    const tRange = tMax - tMin;

    const points = entries.map((entry, i) => {
      // For single entry, center it
      const xFrac = tRange > 0 ? (timestamps[i] - tMin) / tRange : 0.5;
      const yFrac = (entry.weight_kg - yMin) / yRange;
      return {
        x: PADDING.left + xFrac * plotWidth,
        y: PADDING.top + (1 - yFrac) * plotHeight, // Invert Y (screen coords)
        weight: entry.weight_kg,
        date: entry.date,
      };
    });

    // Trend line points
    const trendPoints = trendValues.map((val, i) => {
      if (i >= points.length) return null;
      const yFrac = (val - yMin) / yRange;
      return {
        x: points[i].x,
        y: PADDING.top + (1 - yFrac) * plotHeight,
      };
    }).filter(Boolean) as { x: number; y: number }[];

    // Goal line Y position
    const goalY = goalWeight != null
      ? PADDING.top + (1 - (goalWeight - yMin) / yRange) * plotHeight
      : null;

    // Y-axis grid values
    const gridValues: number[] = [];
    for (let i = 0; i < GRID_LINE_COUNT; i++) {
      const val = yMin + (yRange * i) / (GRID_LINE_COUNT - 1);
      gridValues.push(Math.round(val * 10) / 10);
    }

    // X-axis labels (pick evenly spaced dates)
    const xLabels: { x: number; label: string }[] = [];
    if (entries.length <= X_LABEL_COUNT) {
      entries.forEach((e, i) => {
        xLabels.push({ x: points[i].x, label: formatDisplayDate(e.date) });
      });
    } else {
      for (let i = 0; i < X_LABEL_COUNT; i++) {
        const idx = Math.round((i / (X_LABEL_COUNT - 1)) * (entries.length - 1));
        xLabels.push({ x: points[idx].x, label: formatDisplayDate(entries[idx].date) });
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

          {/* Trend line segments */}
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

          {/* Data line segments */}
          {chartData.points.map((pt, i) => {
            if (i === 0) return null;
            const prev = chartData.points[i - 1];
            return (
              <LineSegment
                key={`line-${i}`}
                x1={prev.x} y1={prev.y}
                x2={pt.x} y2={pt.y}
                color={Colors.primary}
                thickness={LINE_THICKNESS}
              />
            );
          })}

          {/* Data dots */}
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
