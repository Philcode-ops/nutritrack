import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NutritionProvider } from '../components/NutritionContext';

export default function RootLayout() {
  return (
    <NutritionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NutritionProvider>
  );
}
