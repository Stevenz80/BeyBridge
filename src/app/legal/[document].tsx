import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '@/components/localized-text';
import { RecoveryButton, RecoveryFeedback } from '@/components/auth-recovery-form';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { getLegalDocument, legalConfigured, legalEmail } from '@/lib/legal';

export default function LegalScreen() {
  const { document } = useLocalSearchParams<{ document: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const key = document === 'privacy' || document === 'terms' || document === 'deletion' ? document : null;
  if (!key) return <RecoveryFeedback error message="This document is not available." />;
  const content = getLegalDocument(key);
  return <ScrollView contentInsetAdjustmentBehavior="automatic"
    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
    <Stack.Screen options={{ title: content.title }} />
    <Text accessibilityRole="header" style={styles.title}>{content.title}</Text>
    <Text style={styles.body}>{`Updated ${content.version}`}</Text>
    {!legalConfigured ? <RecoveryFeedback error message="Draft: operator, support, and retention details must be completed before release." /> : null}
    {content.sections.map(section => <Text key={section.title} selectable style={styles.body}>
      <Text style={styles.heading}>{`${section.title}\n`}</Text>{section.body}
    </Text>)}
    {legalEmail ? <RecoveryButton label="Contact support" secondary
      onPress={() => { void Linking.openURL(`mailto:${legalEmail}`).catch(() => undefined); }} /> : null}
    {key === 'deletion' ? <RecoveryButton label="Open account deletion" onPress={() => router.push('/account/delete')} /> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800' },
  heading: { color: Colors.text, fontSize: FontSize.md, fontWeight: '800', lineHeight: 28 },
  body: { color: Colors.textMuted, fontSize: FontSize.md, lineHeight: 25 },
});
