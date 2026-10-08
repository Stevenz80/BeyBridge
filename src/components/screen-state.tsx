import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '@/components/localized-text';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useLocalization } from '@/providers/LocalizationProvider';

export default function ScreenState({ icon, title, message, action, onAction, children }: {
  icon: string;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.xl + insets.bottom }]}>
      <View style={styles.icon}>
        <Ionicons name={icon as never} size={34} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {children ? <View style={styles.feedback}>{children}</View> : null}
      {action && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t(action)} onPress={onAction}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{action}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  icon: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34,
    backgroundColor: Colors.primarySoft },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  message: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  feedback: { alignSelf: 'stretch' },
  button: { minHeight: 50, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.primary },
  buttonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900', textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
