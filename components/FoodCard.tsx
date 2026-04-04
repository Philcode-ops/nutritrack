import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FoodItem } from '../constants/types';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

interface Props {
  food: FoodItem;
  onPress?: () => void;
}

export function FoodCard({ food, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>{food.name}</Text>
        {food.brand && <Text style={styles.brand}>{food.brand}</Text>}
      </View>
      <View style={styles.macros}>
        <View style={styles.macroBadge}>
          <Text style={[styles.macroValue, { color: Colors.calories }]}>{food.calories}</Text>
          <Text style={styles.macroLabel}>kcal</Text>
        </View>
        <View style={styles.macroBadge}>
          <Text style={[styles.macroValue, { color: Colors.carbs }]}>{food.carbs}g</Text>
          <Text style={styles.macroLabel}>Carbs</Text>
        </View>
        <View style={styles.macroBadge}>
          <Text style={[styles.macroValue, { color: Colors.fat }]}>{food.fat}g</Text>
          <Text style={styles.macroLabel}>Fat</Text>
        </View>
        <View style={styles.macroBadge}>
          <Text style={[styles.macroValue, { color: Colors.protein }]}>{food.protein}g</Text>
          <Text style={styles.macroLabel}>Protein</Text>
        </View>
      </View>
      <Text style={styles.per100}>per 100g</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    marginBottom: Spacing.sm,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  brand: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroBadge: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  macroLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  per100: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
});
