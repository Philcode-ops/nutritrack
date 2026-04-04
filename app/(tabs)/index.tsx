import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNutritionContext } from '../../components/NutritionContext';
import { ProgressBar } from '../../components/ProgressBar';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { todayEntries, todayTotals, calorieGoal, removeFoodEntry, loaded } = useNutritionContext();

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const remaining = Math.max(0, calorieGoal - todayTotals.calories);

  // Estimate macro goals based on calorie goal (balanced diet)
  const carbGoal = Math.round((calorieGoal * 0.45) / 4);  // 45% from carbs, 4 cal/g
  const fatGoal = Math.round((calorieGoal * 0.30) / 9);    // 30% from fat, 9 cal/g
  const proteinGoal = Math.round((calorieGoal * 0.25) / 4); // 25% from protein, 4 cal/g

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Remove Entry', `Remove "${name}" from today's log?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFoodEntry(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerCard}>
          <Text style={styles.greeting}>Today's Nutrition</Text>
          <View style={styles.calorieRing}>
            <Text style={styles.calorieNumber}>{Math.round(todayTotals.calories)}</Text>
            <Text style={styles.calorieUnit}>kcal consumed</Text>
            <Text style={styles.remainingText}>{Math.round(remaining)} kcal remaining</Text>
          </View>
          <ProgressBar
            label="Calories"
            current={todayTotals.calories}
            goal={calorieGoal}
            color={Colors.calories}
            unit=" kcal"
            showPercentage
          />
        </View>

        {/* Macros */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Macros</Text>
          <ProgressBar label="Carbs" current={todayTotals.carbs} goal={carbGoal} color={Colors.carbs} unit="g" />
          <ProgressBar label="Fat" current={todayTotals.fat} goal={fatGoal} color={Colors.fat} unit="g" />
          <ProgressBar label="Protein" current={todayTotals.protein} goal={proteinGoal} color={Colors.protein} unit="g" />
        </View>

        {/* Today's Meals */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Today's Log</Text>
          {todayEntries.length === 0 ? (
            <Text style={styles.emptyText}>No food logged yet today. Tap the button below to add food!</Text>
          ) : (
            todayEntries.map((entry) => {
              const factor = entry.grams / 100;
              return (
                <View key={entry.id} style={styles.logEntry}>
                  <View style={styles.logInfo}>
                    <Text style={styles.logName} numberOfLines={1}>{entry.food.name}</Text>
                    <Text style={styles.logDetail}>
                      {entry.grams}g · {Math.round(entry.food.calories * factor)} kcal
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(entry.id, entry.food.name)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/search')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={Colors.textLight} />
        <Text style={styles.fabText}>Add Food</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  calorieRing: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  calorieNumber: {
    fontSize: FontSize.xxl + 8,
    fontWeight: '800',
    color: Colors.primary,
  },
  calorieUnit: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  remainingText: {
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  logName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  logDetail: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
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
});
