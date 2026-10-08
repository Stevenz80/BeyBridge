import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Text from '@/components/localized-text';
import { Colors, FontSize, Spacing } from '@/constants/theme';

export default function DetailSection({ title, icon, children, style }: {
  title: string;
  icon: string;
  children: ReactNode;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <View style={styles.heading}>
        <Ionicons name={icon as never} size={20} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
});
