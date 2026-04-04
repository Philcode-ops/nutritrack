import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNutritionContext } from '../../components/NutritionContext';
import { AddFoodModal } from '../../components/AddFoodModal';
import { CustomMeal, FoodItem } from '../../constants/types';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { v4 as uuidv4 } from 'uuid';

export default function MealsScreen() {
  const { customMeals, addCustomMeal, removeCustomMeal, addFoodEntry } = useNutritionContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFat, setMealFat] = useState('');
  const [mealProtein, setMealProtein] = useState('');

  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const resetForm = () => {
    setMealName('');
    setMealCalories('');
    setMealCarbs('');
    setMealFat('');
    setMealProtein('');
  };

  const handleCreate = () => {
    if (!mealName.trim()) {
      Alert.alert('Error', 'Please enter a meal name');
      return;
    }
    const meal: CustomMeal = {
      id: uuidv4(),
      name: mealName.trim(),
      calories: parseFloat(mealCalories) || 0,
      carbs: parseFloat(mealCarbs) || 0,
      fat: parseFloat(mealFat) || 0,
      protein: parseFloat(mealProtein) || 0,
    };
    addCustomMeal(meal);
    resetForm();
    setShowCreateModal(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Meal', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeCustomMeal(id) },
    ]);
  };

  const handleMealPress = (meal: CustomMeal) => {
    const food: FoodItem = {
      id: meal.id,
      name: meal.name,
      calories: meal.calories,
      carbs: meal.carbs,
      fat: meal.fat,
      protein: meal.protein,
      source: 'custom',
    };
    setSelectedFood(food);
    setAddModalVisible(true);
  };

  const renderMeal = ({ item }: { item: CustomMeal }) => (
    <TouchableOpacity style={styles.mealCard} onPress={() => handleMealPress(item)} activeOpacity={0.7}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealName} numberOfLines={1}>{item.name}</Text>
        <TouchableOpacity
          onPress={() => handleDelete(item.id, item.name)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>
      <View style={styles.mealMacros}>
        <MacroPill label="Cal" value={`${item.calories}`} color={Colors.calories} />
        <MacroPill label="C" value={`${item.carbs}g`} color={Colors.carbs} />
        <MacroPill label="F" value={`${item.fat}g`} color={Colors.fat} />
        <MacroPill label="P" value={`${item.protein}g`} color={Colors.protein} />
      </View>
      <Text style={styles.per100}>per 100g · Tap to log</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {customMeals.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="restaurant-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>No Custom Meals</Text>
          <Text style={styles.emptyText}>
            Create your own meals with custom nutrition values for quick logging.
          </Text>
        </View>
      ) : (
        <FlatList
          data={customMeals}
          keyExtractor={(item) => item.id}
          renderItem={renderMeal}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={Colors.textLight} />
        <Text style={styles.fabText}>Create Meal</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Create Custom Meal</Text>
            <Text style={styles.modalSubtitle}>Enter nutrition values per 100g</Text>

            <Text style={styles.fieldLabel}>Meal Name</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Homemade Granola"
              placeholderTextColor={Colors.textSecondary}
              value={mealName}
              onChangeText={setMealName}
            />

            <View style={styles.macroFields}>
              <MacroField label="Calories" value={mealCalories} onChange={setMealCalories} unit="kcal" />
              <MacroField label="Carbs" value={mealCarbs} onChange={setMealCarbs} unit="g" />
              <MacroField label="Fat" value={mealFat} onChange={setMealFat} unit="g" />
              <MacroField label="Protein" value={mealProtein} onChange={setMealProtein} unit="g" />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { resetForm(); setShowCreateModal(false); }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AddFoodModal
        food={selectedFood}
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={addFoodEntry}
      />
    </SafeAreaView>
  );
}

function MacroPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[macroStyles.pill, { borderColor: color }]}>
      <Text style={[macroStyles.value, { color }]}>{value}</Text>
      <Text style={macroStyles.label}>{label}</Text>
    </View>
  );
}

function MacroField({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit: string }) {
  return (
    <View style={styles.macroFieldContainer}>
      <Text style={styles.macroFieldLabel}>{label} ({unit})</Text>
      <TextInput
        style={styles.macroFieldInput}
        keyboardType="numeric"
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={Colors.textSecondary}
      />
    </View>
  );
}

const macroStyles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    flex: 1,
  },
  value: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  mealCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  mealName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  mealMacros: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  per100: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: Spacing.md,
    left: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl + 16,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  macroFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  macroFieldContainer: {
    width: '47%',
  },
  macroFieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  macroFieldInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  modalButtons: {
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
  createBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  createText: {
    fontSize: FontSize.md,
    color: Colors.textLight,
    fontWeight: '700',
  },
});
