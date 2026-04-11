import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { useNutritionContext } from '../../components/NutritionContext';
import { FoodCard } from '../../components/FoodCard';
import { AddFoodModal } from '../../components/AddFoodModal';
import { FoodItem, FoodSource } from '../../constants/types';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function SearchScreen() {
  const { results, loading, error, source, setSource, search, clearResults } = useFoodSearch();
  const { addFoodEntry } = useNutritionContext();
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleSearch = useCallback(() => {
    search(query);
  }, [query, search]);

  const handleSourceChange = (newSource: FoodSource) => {
    setSource(newSource);
    clearResults();
    setQuery('');
  };

  const handleFoodPress = (food: FoodItem) => {
    setSelectedFood(food);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Source Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, source === 'norwegian' && styles.toggleActive]}
          onPress={() => handleSourceChange('norwegian')}
        >
          <Text style={styles.flagEmoji}>🇳🇴</Text>
          <Text style={[styles.toggleText, source === 'norwegian' && styles.toggleTextActive]}>
            Norwegian
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, source === 'international' && styles.toggleActive]}
          onPress={() => handleSourceChange('international')}
        >
          <Ionicons
            name="globe-outline"
            size={16}
            color={source === 'international' ? Colors.textLight : Colors.text}
          />
          <Text style={[styles.toggleText, source === 'international' && styles.toggleTextActive]}>
            International (USDA)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={source === 'international' ? 'Search foods...' : 'Søk etter mat...'}
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); clearResults(); }}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : results.length === 0 && query.length > 0 ? (
        <View style={styles.center}>
          <Ionicons name="nutrition-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>
            {source === 'norwegian'
              ? 'Søk etter norske matvarer'
              : 'Search USDA food database'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FoodCard food={item} onPress={() => handleFoodPress(item)} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddFoodModal
        food={selectedFood}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={addFoodEntry}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm - 2,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  toggleTextActive: {
    color: Colors.textLight,
  },
  flagEmoji: {
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: Colors.textLight,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
});
