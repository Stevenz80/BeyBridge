import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '@/components/BrandLogo';
import ServiceRequestCard from '@/components/service-request-card';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { ServiceRequest } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useServiceRequests } from '@/providers/ServiceRequestProvider';

const TERMINAL_STATUSES = new Set(['completed', 'declined', 'cancelled']);

export default function CustomerRequestsScreen() {
  const router = useRouter();
  const { user } = useAuth();
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
        <View style={styles.header}>
          <BrandLogo variant="white" width={210} />
          {loading ? <ActivityIndicator color={Colors.primary} /> : null}
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MY REQUESTS</Text>
          <Text style={styles.title}>Jobs stay organized</Text>
          <Text style={styles.subtitle}>
            Follow provider responses, review quotes, and keep active work in one place.
          </Text>
          <View style={styles.statsRow}>
            <MiniStat label="Active" value={active.length} />
            <MiniStat label="Completed" value={past.filter((item) => item.status === 'completed').length} />
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={21} color={Colors.danger} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Could not refresh requests</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void refreshRequests()}>
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
            <RequestSection
              title="Active"
              subtitle="Requests that still need attention or work"
              requests={active}
              onOpen={(id) => router.push({ pathname: '/request/[id]', params: { id } })}
              emptyMessage="No active requests right now."
            />
            {past.length > 0 ? (
              <RequestSection
                title="History"
                subtitle="Completed, declined, and cancelled requests"
                requests={past}
                onOpen={(id) => router.push({ pathname: '/request/[id]', params: { id } })}
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
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  requests: ServiceRequest[];
  onOpen: (id: string) => void;
  emptyMessage?: string;
}) {
  return (
    <View style={styles.section}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {requests.length ? (
        requests.map((request) => (
          <ServiceRequestCard
            key={request.id}
            request={request}
            role="customer"
            onPress={() => onOpen(request.id)}
          />
        ))
      ) : (
        <Text style={styles.sectionEmpty}>{emptyMessage}</Text>
      )}
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
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
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  content: { gap: Spacing.md, paddingBottom: Spacing.xl, backgroundColor: Colors.background },
  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  hero: {
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySoft,
  },
  eyebrow: { color: Colors.primaryDark, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  miniStat: {
    flex: 1,
    gap: 2,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  miniStatValue: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  miniStatLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  section: { gap: Spacing.md, paddingHorizontal: Spacing.md },
  sectionTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  sectionEmpty: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    color: Colors.textMuted,
    backgroundColor: Colors.surface,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  errorCopy: { flex: 1, gap: 2 },
  errorTitle: { color: Colors.danger, fontSize: FontSize.sm, fontWeight: '900' },
  errorText: { color: Colors.danger, fontSize: FontSize.xs },
  retryText: { color: Colors.danger, fontSize: FontSize.xs, fontWeight: '900' },
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.md,
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
