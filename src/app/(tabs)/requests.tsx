import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServiceRequestCard from '@/components/service-request-card';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { ServiceRequest } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';
import { useServiceRequests } from '@/providers/ServiceRequestProvider';

const TERMINAL_STATUSES = new Set(['completed', 'declined', 'cancelled']);

export default function CustomerRequestsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { reviews } = useMarketplace();
  const { customerRequests, error, loading, refreshRequests } = useServiceRequests();

  useFocusEffect(
    useCallback(() => {
      void refreshRequests();
    }, [refreshRequests])
  );

  const { active, past } = useMemo(
    () => ({
      active: customerRequests.filter((request) => !TERMINAL_STATUSES.has(request.status)),
      past: customerRequests.filter((request) => TERMINAL_STATUSES.has(request.status)),
    }),
    [customerRequests]
  );
  const reviewedProviderIds = useMemo(
    () =>
      new Set(
        reviews
          .filter((review) => review.userId === user?.id)
          .map((review) => review.providerId)
      ),
    [reviews, user?.id]
  );

  if (!user) {
    return (
      <CenteredState
        icon="receipt-outline"
        title="Sign in to track requests"
        message="Every quote, acceptance, and completed job will stay organized here."
        action="Go to profile"
        onAction={() => router.push('/profile')}
      />
    );
  }

  if (loading && customerRequests.length === 0) {
    return (
      <CenteredState
        loading
        icon="receipt-outline"
        title="Loading requests"
        message="Checking for the latest provider responses."
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.overview}>
          <View style={styles.overviewTop}>
            <View style={styles.overviewIcon}>
              <Ionicons
                name={active.length > 0 ? 'time-outline' : 'checkmark-circle-outline'}
                size={24}
                color={Colors.primary}
              />
            </View>
            <View style={styles.overviewCopy}>
              <Text style={styles.overviewTitle}>
                {active.length > 0 ? 'Work in progress' : 'You’re all caught up'}
              </Text>
              <Text style={styles.overviewSubtitle}>
                {active.length > 0
                  ? 'Open a request to review the latest provider response.'
                  : 'No active requests. Previous jobs remain available below.'}
              </Text>
            </View>
            {loading ? <ActivityIndicator color={Colors.primary} /> : null}
          </View>
          <View style={styles.statsRow}>
            <MiniStat icon="time-outline" label="Active" value={active.length} />
            <MiniStat
              icon="checkmark-circle-outline"
              label="Completed"
              value={past.filter((item) => item.status === 'completed').length}
            />
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={21} color={Colors.danger} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Could not refresh requests</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refreshRequests()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {customerRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="paper-plane-outline" size={34} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No service requests yet</Text>
            <Text style={styles.emptyText}>
              Open any provider and tap Request service to describe the job and ask for a response.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Browse services</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.textOnPrimary} />
            </Pressable>
          </View>
        ) : (
          <>
            {active.length > 0 ? (
              <RequestSection
                title="Active"
                subtitle="Requests that still need attention or work"
                requests={active}
                onOpen={(id) => router.push({ pathname: '/request/[id]', params: { id } })}
                reviewedProviderIds={reviewedProviderIds}
              />
            ) : null}
            {past.length > 0 ? (
              <RequestSection
                title="History"
                subtitle="Completed, declined, and cancelled requests"
                requests={past}
                onOpen={(id) => router.push({ pathname: '/request/[id]', params: { id } })}
                reviewedProviderIds={reviewedProviderIds}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RequestSection({
  title,
  subtitle,
  requests,
  onOpen,
  reviewedProviderIds,
}: {
  title: string;
  subtitle: string;
  requests: ServiceRequest[];
  onOpen: (id: string) => void;
  reviewedProviderIds: ReadonlySet<string>;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{requests.length}</Text>
        </View>
      </View>
      {requests.map((request) => (
        <ServiceRequestCard
          key={request.id}
          request={request}
          role="customer"
          hasReview={reviewedProviderIds.has(request.providerId)}
          onPress={() => onOpen(request.id)}
        />
      ))}
    </View>
  );
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.miniStat}>
      <View style={styles.miniStatIcon}>
        <Ionicons name={icon as never} size={18} color={Colors.primary} />
      </View>
      <View>
        <Text style={styles.miniStatValue}>{value}</Text>
        <Text style={styles.miniStatLabel}>{label}</Text>
      </View>
    </View>
  );
}

function CenteredState({
  icon,
  title,
  message,
  action,
  onAction,
  loading,
}: {
  icon: string;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  return (
    <SafeAreaView style={styles.centered}>
      <View style={styles.emptyIcon}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <Ionicons name={icon as never} size={34} color={Colors.primary} />
        )}
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: {
    gap: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.background,
  },
  overview: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  overviewIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  overviewCopy: { flex: 1, gap: 2 },
  overviewTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  overviewSubtitle: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  miniStat: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  miniStatIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySoft,
  },
  miniStatValue: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  miniStatLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  section: { gap: Spacing.sm + 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: FontSize.xs },
  sectionCount: {
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  sectionCountText: {
    color: Colors.primaryDark,
    fontSize: FontSize.xs,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  errorCopy: { flex: 1, gap: 2 },
  errorTitle: { color: Colors.danger, fontSize: FontSize.sm, fontWeight: '900' },
  errorText: { color: Colors.danger, fontSize: FontSize.xs },
  retryButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  retryText: { color: Colors.danger, fontSize: FontSize.xs, fontWeight: '900' },
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: Colors.primarySoft,
  },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  primaryButton: {
    minHeight: 50,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  pressed: { opacity: 0.72 },
});
