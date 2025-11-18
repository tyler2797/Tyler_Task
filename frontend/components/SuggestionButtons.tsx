import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../constants/theme';

interface SuggestionButtonsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export const SuggestionButtons: React.FC<SuggestionButtonsProps> = ({
  suggestions,
  onSelect,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Suggestions rapides:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={styles.button}
            onPress={() => onSelect(suggestion)}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: COLORS.text.muted,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  scrollContent: {
    paddingRight: 16,
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.background.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.neon.cyan + '60',
  },
  buttonText: {
    fontSize: 14,
    color: COLORS.neon.cyan,
    fontWeight: '600',
  },
});
