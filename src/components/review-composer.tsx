import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { Review } from '@/lib/types';

type MutationResult = { error: string | null };

export default function ReviewComposer({
  visible,
  providerName,
  review,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  providerName: string;
  review?: Review;
  onClose: () => void;
  onSave: (rating: number, comment: string) => Promise<MutationResult>;
  onDelete?: () => Promise<MutationResult>;
}) {
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [comment, setComment] = useState(review?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const submit = async () => {
    const cleanComment = comment.trim();
    if (cleanComment.length < 10) {
      setFeedback('Tell people a little more—use at least 10 characters.');
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const result = await onSave(rating, cleanComment);
    setSubmitting(false);

    if (result.error) setFeedback(result.error);
    else onClose();
  };

  const confirmDelete = () => {
    if (!onDelete) return;
    Alert.alert('Delete your review?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          const result = await onDelete();
          setSubmitting(false);
          if (result.error) setFeedback(result.error);
          else onClose();
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{review ? 'Edit your review' : 'Write a review'}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{providerName}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close review form"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.ratingCard}>
            <Text style={styles.fieldLabel}>Your rating</Text>
            <View accessibilityRole="radiogroup" style={styles.stars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
                  accessibilityState={{ checked: rating === value }}
                  hitSlop={5}
                  onPress={() => setRating(value)}
                  style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={Colors.star}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={styles.ratingHint}>
              {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating]}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Your experience</Text>
              <Text style={styles.counter}>{comment.length}/1000</Text>
            </View>
            <TextInput
              value={comment}
              onChangeText={(value) => setComment(value.slice(0, 1000))}
              placeholder="What went well? Was the provider punctual, clear, and fairly priced?"
              placeholderTextColor={Colors.textSubtle}
              selectionColor={Colors.primary}
              multiline
              textAlignVertical="top"
              style={styles.input}
            />
          </View>

          {feedback && (
            <View style={styles.feedback}>
              <Ionicons name="alert-circle-outline" size={19} color={Colors.danger} />
              <Text selectable style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
              submitting && styles.disabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={21} color={Colors.textOnPrimary} />
                <Text style={styles.saveLabel}>{review ? 'Save changes' : 'Publish review'}</Text>
              </>
            )}
          </Pressable>

          {review && onDelete && (
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={confirmDelete}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={19} color={Colors.danger} />
              <Text style={styles.deleteLabel}>Delete review</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerText: { flex: 1, gap: 2 },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
  },
  content: { gap: Spacing.lg, padding: Spacing.md, paddingBottom: Spacing.xl },
  ratingCard: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  stars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  starButton: { padding: 2 },
  ratingHint: { color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '800' },
  fieldGroup: { gap: Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  counter: { color: Colors.textMuted, fontSize: FontSize.xs, fontVariant: ['tabular-nums'] },
  input: {
    minHeight: 150,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
    fontSize: FontSize.sm,
    lineHeight: 21,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  feedbackText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 20 },
  saveButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  saveButtonPressed: { backgroundColor: Colors.primaryPressed },
  saveLabel: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  deleteButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  deleteLabel: { color: Colors.danger, fontSize: FontSize.sm, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
