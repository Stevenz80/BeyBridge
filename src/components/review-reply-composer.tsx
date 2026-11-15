import { useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '@/components/localized-text';
import TextInput from '@/components/localized-text-input';
import KeyboardAwareScrollView from '@/components/keyboard-aware-scroll-view';
import CommunityAgreement from '@/components/community-agreement';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm-action';
import { normalizeReviewReply, REVIEW_REPLY_MAX, validateReviewReply } from '@/lib/review-replies';
import type { Review } from '@/lib/types';
import { useLocalization } from '@/providers/LocalizationProvider';

type MutationResult = { error: string | null };

export default function ReviewReplyComposer({ review, onClose, onSave, onDelete }: {
  review: Review;
  onClose: () => void;
  onSave: (body: string) => Promise<MutationResult>;
  onDelete: () => Promise<MutationResult>;
}) {
  const { t, isRTL } = useLocalization();
  const mounted = useRef(true);
  const pending = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [body, setBody] = useState(review.reply?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const length = Array.from(normalizeReviewReply(body)).length;

  const mutate = async (operation: () => Promise<MutationResult>, fallback: string) => {
    if (pending.current || !mounted.current) return;
    pending.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await operation();
      if (!mounted.current) return;
      if (result.error) setFeedback(result.error);
      else onClose();
    } catch {
      if (mounted.current) setFeedback(fallback);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const save = () => {
    const error = validateReviewReply(body);
    if (error) { setFeedback(error); return; }
    if (!accepted) { setFeedback('Agree to the terms and community rules before publishing.'); return; }
    void mutate(() => onSave(normalizeReviewReply(body)), 'Could not save your reply. Please try again.');
  };

  const remove = () => confirmAction({
    title: t('Delete reply?'), message: t('This cannot be undone.'),
    cancelLabel: t('Cancel'), confirmLabel: t('Delete reply'), destructive: true,
    onConfirm: () => { void mutate(onDelete, 'Could not delete your reply. Please try again.'); },
  });

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAwareScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}>
          <Text style={[styles.title, isRTL && styles.rtl]}>{review.reply ? 'Edit reply' : 'Reply to review'}</Text>
          <Text selectable style={[styles.review, isRTL && styles.rtl]}>{review.comment}</Text>
          <Text style={[styles.label, isRTL && styles.rtl]}>Your public reply</Text>
          <TextInput accessibilityLabel={t('Your public reply')} value={body} onChangeText={setBody}
            placeholder="Thank the customer or explain how you can help."
            maxLength={REVIEW_REPLY_MAX * 2}
            multiline editable={!busy} textAlignVertical="top" style={styles.input}
            placeholderTextColor={Colors.textSubtle} selectionColor={Colors.primary} />
          <Text style={styles.counter}>{length}/{REVIEW_REPLY_MAX}</Text>
          {feedback ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{feedback}</Text> : null}
          <CommunityAgreement accepted={accepted} onChange={setAccepted} disabled={busy} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('Save reply')}
            accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={save}
            style={({ pressed }) => [styles.button, styles.primary, (pressed || busy) && styles.dim]}>
            {busy ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.primaryLabel}>Save reply</Text>}
          </Pressable>
          {review.reply ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('Delete reply')}
              accessibilityState={{ disabled: busy }} disabled={busy} onPress={remove}
              style={({ pressed }) => [styles.button, (pressed || busy) && styles.dim]}>
              <Text style={styles.deleteLabel}>Delete reply</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('Cancel')} onPress={onClose}
            style={({ pressed }) => [styles.button, pressed && styles.dim]}>
            <Text style={styles.label}>Cancel</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '800' },
  review: { color: Colors.textMuted, fontSize: FontSize.md, lineHeight: 24 },
  label: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  input: { minHeight: 160, padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: Radius.md, color: Colors.text, backgroundColor: Colors.surface, fontSize: FontSize.md, lineHeight: 24 },
  counter: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'right' },
  error: { color: Colors.danger, fontSize: FontSize.sm, lineHeight: 21 },
  button: { minHeight: 48, padding: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  primary: { backgroundColor: Colors.primary },
  primaryLabel: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: '700' },
  deleteLabel: { color: Colors.danger, fontSize: FontSize.md, fontWeight: '600' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  dim: { opacity: 0.65 },
});
