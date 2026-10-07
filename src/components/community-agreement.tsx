import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import Text from '@/components/localized-text';
import { RecoveryButton } from '@/components/auth-recovery-form';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { getLegalDocument } from '@/lib/legal';
import { useLocalization } from '@/providers/LocalizationProvider';

export default function CommunityAgreement({ accepted, onChange, disabled = false }: {
  accepted: boolean; onChange: (accepted: boolean) => void; disabled?: boolean;
}) {
  const [reading, setReading] = useState(false);
  const { t } = useLocalization();
  const terms = getLegalDocument('terms');
  return <View style={styles.content}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={t('I agree to the terms and community rules')}
      aria-checked={accepted} aria-disabled={disabled}
      accessibilityState={{ checked: accepted, disabled }} disabled={disabled}
      onPress={() => onChange(!accepted)} style={styles.checkbox}>
      <View style={[styles.box, accepted && styles.checked]}><Text style={styles.check}>{accepted ? '✓' : ''}</Text></View>
      <Text style={styles.label}>I agree to the terms and community rules</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Read terms and community rules')}
      onPress={() => setReading(true)} style={styles.link}>
      <Text style={styles.linkText}>Read terms and community rules</Text>
    </Pressable>
    <Modal visible={reading} onRequestClose={() => setReading(false)} presentationStyle="pageSheet" animationType="slide">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.document}>
        <Text accessibilityRole="header" style={styles.title}>{terms.title}</Text>
        {terms.sections.map(section => <Text key={section.title} style={styles.body}>
          <Text style={styles.heading}>{`${section.title}\n`}</Text>{section.body}
        </Text>)}
        <RecoveryButton label="Close terms" onPress={() => setReading(false)} />
      </ScrollView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.xs },
  checkbox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: Colors.primary },
  check: { color: Colors.textOnPrimary, fontWeight: '800' },
  label: { flex: 1, color: Colors.text, fontSize: FontSize.sm, lineHeight: 21 },
  link: { minHeight: 48, justifyContent: 'center' },
  linkText: { color: Colors.primaryDark, fontSize: FontSize.sm, textDecorationLine: 'underline' },
  document: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  title: { fontSize: FontSize.xl, color: Colors.text, fontWeight: '800' },
  body: { fontSize: FontSize.md, lineHeight: 25, color: Colors.textMuted },
  heading: { color: Colors.text, fontWeight: '800' },
});
