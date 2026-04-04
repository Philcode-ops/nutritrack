import React, { useState, useEffect, useMemo } from 'react';
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
import { useNutritionContext } from '../../components/NutritionContext';
import { UserProfile, ACTIVITY_MULTIPLIERS, ACTIVITY_LABELS } from '../../constants/types';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const GENDERS: UserProfile['gender'][] = ['male', 'female'];
const ACTIVITY_LEVELS: UserProfile['activityLevel'][] = [
  'sedentary', 'light', 'moderate', 'active', 'very_active',
];

function calculateBMR(profile: UserProfile): number {
  const base = 10 * profile.currentWeight + 6.25 * 170 - 5 * profile.age;
  return profile.gender === 'male' ? base + 5 : base - 161;
}

function calculateTDEE(profile: UserProfile): number {
  return calculateBMR(profile) * ACTIVITY_MULTIPLIERS[profile.activityLevel];
}

function calculateRecommendedGoal(profile: UserProfile): number {
  const tdee = calculateTDEE(profile);
  if (profile.goalWeight < profile.currentWeight) return Math.round(tdee - 500);
  if (profile.goalWeight > profile.currentWeight) return Math.round(tdee + 300);
  return Math.round(tdee);
}

export default function ProfileScreen() {
  const { profile, setProfile, calorieGoal } = useNutritionContext();
  const [name, setName] = useState(profile.name);
  const [weight, setWeight] = useState(String(profile.currentWeight));
  const [goalWeight, setGoalWeight] = useState(String(profile.goalWeight));
  const [age, setAge] = useState(String(profile.age));
  const [gender, setGender] = useState(profile.gender);
  const [activityLevel, setActivityLevel] = useState(profile.activityLevel);
  const [manualGoal, setManualGoal] = useState(profile.manualCalorieGoal ? String(profile.manualCalorieGoal) : '');
  const [saved, setSaved] = useState(false);

  // Sync state when profile loads from storage
  useEffect(() => {
    setName(profile.name);
    setWeight(String(profile.currentWeight));
    setGoalWeight(String(profile.goalWeight));
    setAge(String(profile.age));
    setGender(profile.gender);
    setActivityLevel(profile.activityLevel);
    setManualGoal(profile.manualCalorieGoal ? String(profile.manualCalorieGoal) : '');
  }, [profile]);

  const currentProfile: UserProfile = useMemo(() => ({
    name,
    currentWeight: parseFloat(weight) || 70,
    goalWeight: parseFloat(goalWeight) || 70,
    age: parseInt(age) || 30,
    gender,
    activityLevel,
    manualCalorieGoal: manualGoal ? parseFloat(manualGoal) || undefined : undefined,
  }), [name, weight, goalWeight, age, gender, activityLevel, manualGoal]);

  const recommendedGoal = useMemo(() => calculateRecommendedGoal(currentProfile), [currentProfile]);
  const bmr = useMemo(() => Math.round(calculateBMR(currentProfile)), [currentProfile]);
  const tdee = useMemo(() => Math.round(calculateTDEE(currentProfile)), [currentProfile]);

  const handleSave = () => {
    setProfile(currentProfile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUseCalculated = () => {
    setManualGoal('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Personal Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Your name"
            placeholderTextColor={Colors.textSecondary}
            value={name}
            onChangeText={setName}
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Current Weight (kg)</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Goal Weight (kg)</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="numeric"
                value={goalWeight}
                onChangeText={setGoalWeight}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Age</Text>
          <TextInput
            style={styles.fieldInput}
            keyboardType="numeric"
            value={age}
            onChangeText={setAge}
          />

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.toggleRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.toggleOption, gender === g && styles.toggleSelected]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.toggleOptionText, gender === g && styles.toggleSelectedText]}>
                  {g === 'male' ? 'Male' : 'Female'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Activity Level */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Activity Level</Text>
          {ACTIVITY_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.activityOption, activityLevel === level && styles.activitySelected]}
              onPress={() => setActivityLevel(level)}
            >
              <View style={[styles.radio, activityLevel === level && styles.radioSelected]}>
                {activityLevel === level && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.activityText, activityLevel === level && styles.activityTextSelected]}>
                {ACTIVITY_LABELS[level]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calorie Goal */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daily Calorie Goal</Text>

          <View style={styles.calculationBox}>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>BMR (Mifflin-St Jeor)</Text>
              <Text style={styles.calcValue}>{bmr} kcal</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>TDEE</Text>
              <Text style={styles.calcValue}>{tdee} kcal</Text>
            </View>
            <View style={[styles.calcRow, styles.calcRowHighlight]}>
              <Text style={styles.calcLabelBold}>Recommended Goal</Text>
              <Text style={styles.calcValueBold}>{recommendedGoal} kcal</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Manual Override (optional)</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
              keyboardType="numeric"
              placeholder={String(recommendedGoal)}
              placeholderTextColor={Colors.textSecondary}
              value={manualGoal}
              onChangeText={setManualGoal}
            />
            {manualGoal.length > 0 && (
              <TouchableOpacity style={styles.resetBtn} onPress={handleUseCalculated}>
                <Text style={styles.resetText}>Use Calculated</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.hint}>
            Active goal: {calorieGoal} kcal/day {manualGoal ? '(manual)' : '(calculated)'}
          </Text>
        </View>

        {/* Save */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          {saved ? (
            <>
              <Ionicons name="checkmark-circle" size={22} color={Colors.textLight} />
              <Text style={styles.saveText}>Saved!</Text>
            </>
          ) : (
            <Text style={styles.saveText}>Save Profile</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
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
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
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
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  halfField: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  toggleSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  toggleSelectedText: {
    color: Colors.textLight,
  },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  activitySelected: {
    backgroundColor: Colors.primaryLight,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  activityText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  activityTextSelected: {
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  calculationBox: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  calcRowHighlight: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  calcLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  calcValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  calcLabelBold: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
  },
  calcValueBold: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '700',
  },
  manualRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  resetBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textLight,
  },
});
