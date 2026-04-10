import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNutritionContext } from '../../components/NutritionContext';
import {
  UserProfile,
  ActivityLevel,
  GoalMode,
  ACTIVITY_LABELS,
  GOAL_MODE_LABELS,
} from '../../constants/types';
import { computeAllTargets, NutritionProfile } from '../../constants/nutrition';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const GENDERS: UserProfile['gender'][] = ['male', 'female'];
const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOAL_MODES: GoalMode[] = ['maintenance', 'fat_loss', 'muscle_gain', 'endurance', 'strength'];

const GOAL_MODE_ICONS: Record<GoalMode, string> = {
  maintenance: 'heart-outline',
  fat_loss: 'flame-outline',
  muscle_gain: 'barbell-outline',
  endurance: 'bicycle-outline',
  strength: 'fitness-outline',
};

export default function ProfileScreen() {
  const { profile, setProfile } = useNutritionContext();

  const [name, setName] = useState(profile.name);
  const [weight, setWeight] = useState(String(profile.currentWeight));
  const [goalWeight, setGoalWeight] = useState(String(profile.goalWeight));
  const [height, setHeight] = useState(String(profile.height));
  const [age, setAge] = useState(String(profile.age));
  const [gender, setGender] = useState(profile.gender);
  const [bodyFat, setBodyFat] = useState(profile.bodyFatPercent ? String(profile.bodyFatPercent) : '');
  const [activityLevel, setActivityLevel] = useState(profile.activityLevel);
  const [goalMode, setGoalMode] = useState(profile.goalMode);
  const [manualGoal, setManualGoal] = useState(profile.manualCalorieGoal ? String(profile.manualCalorieGoal) : '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setWeight(String(profile.currentWeight));
    setGoalWeight(String(profile.goalWeight));
    setHeight(String(profile.height));
    setAge(String(profile.age));
    setGender(profile.gender);
    setBodyFat(profile.bodyFatPercent ? String(profile.bodyFatPercent) : '');
    setActivityLevel(profile.activityLevel);
    setGoalMode(profile.goalMode);
    setManualGoal(profile.manualCalorieGoal ? String(profile.manualCalorieGoal) : '');
  }, [profile]);

  const currentProfile = useMemo((): UserProfile => ({
    name,
    currentWeight: parseFloat(weight) || 75,
    goalWeight: parseFloat(goalWeight) || 75,
    height: parseFloat(height) || 175,
    age: parseInt(age) || 30,
    gender,
    bodyFatPercent: bodyFat ? parseFloat(bodyFat) || undefined : undefined,
    activityLevel,
    goalMode,
    manualCalorieGoal: manualGoal ? parseFloat(manualGoal) || undefined : undefined,
  }), [name, weight, goalWeight, height, age, gender, bodyFat, activityLevel, goalMode, manualGoal]);

  const nutritionProfile = useMemo((): NutritionProfile => ({
    body: {
      currentWeightKg: currentProfile.currentWeight,
      goalWeightKg: currentProfile.goalWeight,
      heightCm: currentProfile.height,
      age: currentProfile.age,
      gender: currentProfile.gender,
      bodyFatPercent: currentProfile.bodyFatPercent,
    },
    activityLevel: currentProfile.activityLevel,
    goalMode: currentProfile.goalMode,
    manualCalorieOverride: currentProfile.manualCalorieGoal,
  }), [currentProfile]);

  const targets = useMemo(() => computeAllTargets(nutritionProfile), [nutritionProfile]);

  const handleSave = () => {
    setProfile(currentProfile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Body Data ──────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Body Data</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput style={styles.fieldInput} placeholder="Your name" placeholderTextColor={Colors.textSecondary} value={name} onChangeText={setName} />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Current Weight (kg)</Text>
              <TextInput style={styles.fieldInput} keyboardType="numeric" value={weight} onChangeText={setWeight} />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Goal Weight (kg)</Text>
              <TextInput style={styles.fieldInput} keyboardType="numeric" value={goalWeight} onChangeText={setGoalWeight} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Height (cm)</Text>
              <TextInput style={styles.fieldInput} keyboardType="numeric" value={height} onChangeText={setHeight} />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Age</Text>
              <TextInput style={styles.fieldInput} keyboardType="numeric" value={age} onChangeText={setAge} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.toggleRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity key={g} style={[styles.toggleOption, gender === g && styles.toggleSelected]} onPress={() => setGender(g)}>
                <Text style={[styles.toggleOptionText, gender === g && styles.toggleSelectedText]}>
                  {g === 'male' ? 'Male' : 'Female'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Body Fat % (optional — enables Cunningham formula)</Text>
          <TextInput style={styles.fieldInput} keyboardType="numeric" placeholder="e.g. 18" placeholderTextColor={Colors.textSecondary} value={bodyFat} onChangeText={setBodyFat} />
        </View>

        {/* ── Goal Mode ──────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Training Goal</Text>
          {GOAL_MODES.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.goalOption, goalMode === mode && styles.goalSelected]}
              onPress={() => setGoalMode(mode)}
            >
              <View style={styles.goalIconWrap}>
                <Ionicons name={GOAL_MODE_ICONS[mode] as any} size={20} color={goalMode === mode ? Colors.primary : Colors.textSecondary} />
              </View>
              <Text style={[styles.goalText, goalMode === mode && styles.goalTextSelected]}>
                {GOAL_MODE_LABELS[mode]}
              </Text>
              {goalMode === mode && (
                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Activity Level ─────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Activity Level</Text>
          <Text style={styles.hint}>Used as initial TDEE estimate. Will be refinable with logged data in future.</Text>
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

        {/* ── Calculation Breakdown ──────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daily Targets</Text>

          <View style={styles.calculationBox}>
            <CalcRow label={`RMR (${bodyFat ? 'Cunningham' : 'Mifflin-St Jeor'})`} value={`${targets.rmr} kcal`} />
            <CalcRow label="Estimated TDEE" value={`${targets.tdee} kcal`} />
            <View style={styles.divider} />
            <CalcRow label="Calorie Target" value={`${targets.calories} kcal`} bold color={Colors.primary} />
            <CalcRow label="Protein" value={`${targets.protein}g`} color={Colors.protein}
              detail={`~${(targets.protein / (parseFloat(weight) || 75)).toFixed(1)} g/kg`} />
            <CalcRow label="Fat" value={`${targets.fat}g`} color={Colors.fat}
              detail={`~${Math.round(targets.fat * 9 / targets.calories * 100)}% of kcal`} />
            <CalcRow label="Carbs" value={`${targets.carbs}g`} color={Colors.carbs}
              detail={`fills remaining`} />
          </View>

          {targets.isManualOverride && (
            <Text style={styles.overrideNote}>Calories manually overridden. Macros computed from your override.</Text>
          )}

          <Text style={styles.fieldLabel}>Manual Calorie Override (optional)</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
              keyboardType="numeric"
              placeholder={String(targets.calories)}
              placeholderTextColor={Colors.textSecondary}
              value={manualGoal}
              onChangeText={setManualGoal}
            />
            {manualGoal.length > 0 && (
              <TouchableOpacity style={styles.resetBtn} onPress={() => setManualGoal('')}>
                <Text style={styles.resetText}>Use Calculated</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Save ───────────────────────────────── */}
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

function CalcRow({ label, value, bold, color, detail }: {
  label: string; value: string; bold?: boolean; color?: string; detail?: string;
}) {
  return (
    <View style={styles.calcRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.calcLabel, bold && styles.calcLabelBold, color ? { color } : undefined]}>{label}</Text>
        {detail && <Text style={styles.calcDetail}>{detail}</Text>}
      </View>
      <Text style={[styles.calcValue, bold && styles.calcValueBold, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
  fieldInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.md,
    color: Colors.text, marginBottom: Spacing.md,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  halfField: { flex: 1 },
  toggleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  toggleOption: {
    flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  toggleSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleOptionText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  toggleSelectedText: { color: Colors.textLight },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.md, fontStyle: 'italic' },
  goalOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  goalSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  goalIconWrap: { width: 32, alignItems: 'center' },
  goalText: { fontSize: FontSize.sm, color: Colors.text, flex: 1 },
  goalTextSelected: { fontWeight: '700', color: Colors.primaryDark },
  activityOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: Spacing.xs,
  },
  activitySelected: { backgroundColor: Colors.primaryLight },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm,
  },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  activityText: { fontSize: FontSize.sm, color: Colors.text },
  activityTextSelected: { fontWeight: '600', color: Colors.primaryDark },
  calculationBox: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  calcRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  calcLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  calcLabelBold: { fontWeight: '700' },
  calcValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  calcValueBold: { fontSize: FontSize.md, fontWeight: '700' },
  calcDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  overrideNote: {
    fontSize: FontSize.xs, color: Colors.accent, fontStyle: 'italic', marginBottom: Spacing.sm,
  },
  manualRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm },
  resetBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  resetText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 6,
  },
  saveText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textLight },
});
