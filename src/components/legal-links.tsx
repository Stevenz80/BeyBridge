import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useLocalization } from '@/providers/LocalizationProvider';

type LegalLinksProps = {
  // Public account-deletion page, required to be reachable without the app account.
  deletion?: boolean;
  // Signed-in only: the blocked-users screen requires an account.
  blockedUsers?: boolean;
};

export default function LegalLinks({ deletion = false, blockedUsers = false }: LegalLinksProps) {
  const router = useRouter();
  const { t } = useLocalization();
  return <View style={styles.links}>
    {blockedUsers ? <Pressable accessibilityRole="link" accessibilityLabel={t('Blocked users')}
      onPress={() => router.push('/account/blocked-users')} style={styles.link}>
      <Text style={styles.text}>Blocked users</Text>
    </Pressable> : null}
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
  </View>;
}

const styles = StyleSheet.create({
  links: { alignSelf: 'stretch', alignItems: 'center', gap: Spacing.xs },
  link: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  text: { color: Colors.primaryDark, fontSize: FontSize.sm, textAlign: 'center', textDecorationLine: 'underline' },
  danger: { color: Colors.danger },
});
