import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FoodItem, FoodLogEntry } from '../constants/types';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  food: FoodItem | null;
  visible: boolean;
  onClose: () => void;
  onAdd: (entry: FoodLogEntry) => void;
}

export function AddFoodModal({ food, visible, onClose, onAdd }: Props) {
  const [grams, setGrams] = useState('100');

  if (!food) return null;

  const g = parseFloat(grams) || 0;
  const factor = g / 100;
  const cal = Math.round(food.calories * factor);
  const carbs = Math.round(food.carbs * factor * 10) / 10;
  const fat = Math.round(food.fat * factor * 10) / 10;
  const protein = Math.round(food.protein * factor * 10) / 10;

  const handleAdd = () => {
    if (g <= 0) return;
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onAdd({
      id: uuidv4(),
      food,
      grams: g,
      date: dateKey,
      timestamp: Date.now(),
    });
    setGrams('100');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{food.name}</Text>
          {food.brand && <Text style={styles.brand}>{food.brand}</Text>}

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Serving size (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={grams}
              onChangeText={setGrams}
              selectTextOnFocus
            />
          </View>

          <View style={styles.summary}>
            <SummaryItem label="Calories" value={`${cal} kcal`} color={Colors.calories} />
            <SummaryItem label="Carbs" value={`${carbs}g`} color={Colors.carbs} />
            <SummaryItem label="Fat" value={`${fat}g`} color={Colors.fat} />
            <SummaryItem label="Protein" value={`${protein}g`} color={Colors.protein} />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
              <Text style={styles.addText}>Add to Today's Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl + 16,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  brand: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    width: 100,
    textAlign: 'center',
    color: Colors.text,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  addBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  addText: {
    fontSize: FontSize.md,
    color: Colors.textLight,
    fontWeight: '700',
  },
});
