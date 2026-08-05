import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import type { ServiceRequest, ServiceRequestStatus } from '@/lib/types';

type Props = {
  request: ServiceRequest;
  role: 'customer' | 'provider';
  onPress: () => void;
};

const STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  requested: 'New request',
  quoted: 'Quote sent',
  accepted: 'Accepted',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export default function ServiceRequestCard({ request, role, onPress }: Props) {
  const title = role === 'customer' ? request.providerName : request.customerName;
  const isTerminal = ['completed', 'declined', 'cancelled'].includes(request.status);
  const isAttention = request.status === 'requested' || request.status === 'quoted';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${STATUS_LABELS[request.status]} from ${title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={role === 'customer' ? 'construct-outline' : 'person-outline'}
            size={22}
            color={Colors.primary}
          />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.date}>{formatDate(request.createdAt)}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            isAttention && styles.statusAttention,
            request.status === 'completed' && styles.statusSuccess,
            isTerminal && request.status !== 'completed' && styles.statusMuted,
          ]}
        >
          <Text style={styles.statusText}>{STATUS_LABELS[request.status]}</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {request.description}
      </Text>

      <View style={styles.metaRow}>
        <Meta icon="location-outline" text={request.serviceAddress} />
        {request.preferredSchedule ? (
          <Meta icon="calendar-outline" text={request.preferredSchedule} />
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.tags}>
          {request.urgency !== 'standard' && (
            <View style={styles.urgentTag}>
              <Ionicons name="flash" size={13} color={Colors.danger} />
              <Text style={styles.urgentText}>
                {request.urgency === 'emergency' ? 'Emergency' : 'Urgent'}
              </Text>
            </View>
          )}
          {request.quotedPrice !== null ? (
            <Text style={styles.price}>
              Quote: {formatMoney(request.quotedPrice, request.budgetCurrency)}
            </Text>
          ) : request.budgetAmount !== null ? (
            <Text style={styles.price}>
              Budget: {formatMoney(request.budgetAmount, request.budgetCurrency)}
            </Text>
          ) : null}
        </View>
        <View style={styles.detailsLink}>
          <Text style={styles.detailsText}>Details</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon as never} size={14} color={Colors.textMuted} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}

function formatMoney(value: number, currency: 'USD' | 'LBP') {
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value)} ${currency}`;
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  pressed: { opacity: 0.74 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  headingCopy: { flex: 1, gap: 2 },
  title: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  date: { color: Colors.textMuted, fontSize: FontSize.xs },
  statusBadge: {
    maxWidth: 104,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  statusAttention: { backgroundColor: '#FFF4D6' },
  statusSuccess: { backgroundColor: Colors.successSoft },
  statusMuted: { backgroundColor: Colors.background },
  statusText: { color: Colors.text, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  description: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 20 },
  metaRow: { gap: Spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, color: Colors.textMuted, fontSize: FontSize.xs },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  tags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  urgentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.dangerSoft,
  },
  urgentText: { color: Colors.danger, fontSize: 10, fontWeight: '900' },
  price: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '800' },
  detailsLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900' },
});
