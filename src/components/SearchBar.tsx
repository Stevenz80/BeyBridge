import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import TextInput from '@/components/localized-text-input';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  compact?: boolean;
};

export default function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'What service do you need?',
  autoFocus = false,
  accessibilityLabel = 'Search for a service',
  testID,
  compact = false,
}: SearchBarProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]} testID={testID}>
      <Ionicons name="search" size={21} color={Colors.primary} />
      <TextInput
        style={[styles.input, compact && styles.inputCompact]}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSubtle}
        multiline={false}
        numberOfLines={1}
        textAlignVertical="center"
        maxFontSizeMultiplier={1.3}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCapitalize="none"
        selectionColor={Colors.primary}
        accessibilityLabel={accessibilityLabel}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clearButton, pressed && styles.iconPressed]}
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
    minWidth: 0,
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
  containerCompact: { height: 48, borderRadius: Radius.full },
  input: {
    minWidth: 0,
    flex: 1,
    height: '100%',
    color: Colors.text,
    fontSize: FontSize.md,
  },
  inputCompact: {
    paddingVertical: 0,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  clearButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  iconPressed: { backgroundColor: Colors.primarySoft },
  submit: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  submitPressed: { backgroundColor: Colors.primaryPressed },
});
