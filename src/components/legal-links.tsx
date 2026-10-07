import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useLocalization } from '@/providers/LocalizationProvider';

export default function LegalLinks({ deletion = false }: { deletion?: boolean }) {
  const router = useRouter();
  const { t } = useLocalization();
  return <View style={styles.links}>
    <Pressable accessibilityRole="link" accessibilityLabel={t('Privacy policy')}
      onPress={() => router.push('/legal/privacy')} style={styles.link}>
      <Text style={styles.text}>Privacy policy</Text>
    </Pressable>
    <Pressable accessibilityRole="link" accessibilityLabel={t('Terms and community rules')}
      onPress={() => router.push('/legal/terms')} style={styles.link}>
      <Text style={styles.text}>Terms and community rules</Text>
    </Pressable>
    {deletion ? <Pressable accessibilityRole="link" accessibilityLabel={t('Delete account')}
      onPress={() => router.push('/account/delete')} style={styles.link}>
      <Text style={[styles.text, styles.danger]}>Delete account</Text>
    </Pressable> : null}
    {deletion ? <Pressable accessibilityRole="link" accessibilityLabel={t('Blocked users')}
      onPress={() => router.push('/account/blocked-users')} style={styles.link}>
      <Text style={styles.text}>Blocked users</Text>
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  links: { gap: Spacing.xs },
  link: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  text: { color: Colors.primaryDark, fontSize: FontSize.sm, textDecorationLine: 'underline' },
  danger: { color: Colors.danger },
});
