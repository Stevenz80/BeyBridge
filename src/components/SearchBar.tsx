import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'What service do you need?',
  autoFocus = false,
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={21} color={Colors.primary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSubtle}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCapitalize="none"
        selectionColor={Colors.primary}
        accessibilityLabel="Search for a service"
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={21} color={Colors.textSubtle} />
        </Pressable>
      )}
      {onSubmit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit search"
          onPress={onSubmit}
          style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}
        >
          <Ionicons name="arrow-forward" size={20} color={Colors.textOnPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    height: '100%',
    color: Colors.text,
    fontSize: FontSize.md,
  },
  submit: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  submitPressed: { backgroundColor: Colors.primaryPressed },
});
