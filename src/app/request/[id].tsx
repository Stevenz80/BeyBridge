import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import type {
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestTransitionInput,
} from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';
import { useServiceRequests } from '@/providers/ServiceRequestProvider';

const STATUS_COPY: Record<ServiceRequestStatus, { label: string; message: string; icon: string }> = {
  requested: {
    label: 'Awaiting provider',
    message: 'The provider can accept, decline, or send a quote.',
    icon: 'paper-plane-outline',
  },
  quoted: {
    label: 'Quote ready',
    message: 'The customer can accept the quote or decline it.',
    icon: 'pricetag-outline',
  },
  accepted: {
    label: 'Accepted',
    message: 'The provider accepted the job. Confirm timing before work begins.',
    icon: 'checkmark-circle-outline',
  },
  scheduled: {
    label: 'Scheduled',
    message: 'The service has been scheduled by the provider.',
    icon: 'calendar-outline',
  },
  in_progress: {
    label: 'In progress',
    message: 'The provider has started working on this request.',
    icon: 'construct-outline',
  },
  completed: {
    label: 'Completed',
    message: 'The provider marked this service as completed.',
    icon: 'checkmark-done-circle-outline',
  },
  declined: {
    label: 'Declined',
    message: 'The provider could not take this request.',
    icon: 'close-circle-outline',
  },
  cancelled: {
    label: 'Cancelled',
    message: 'This request is closed and no further action is needed.',
    icon: 'ban-outline',
  },
};

export default function ServiceRequestDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { providers } = useMarketplace();
  const {
    customerRequests,
    providerRequests,
    loading,
    refreshRequests,
    transitionServiceRequest,
  } = useServiceRequests();
  const [busy, setBusy] = useState(false);
  const [providerMessage, setProviderMessage] = useState('');
  const [quote, setQuote] = useState('');

  useFocusEffect(
    useCallback(() => {
      void refreshRequests();
    }, [refreshRequests])
  );

  const request = useMemo(
    () =>
      [...customerRequests, ...providerRequests].find((item) => item.id === id) ?? null,
    [customerRequests, id, providerRequests]
  );
  const role = request?.customerId === user?.id ? 'customer' : 'provider';
  const provider = request ? providers.find((item) => item.id === request.providerId) : null;

  if (!user) {
    return (
      <CenteredState
        icon="lock-closed-outline"
        title="Sign in to view this request"
        message="Service requests are private to the customer and provider."
        action="Go to profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  if (!request && loading) {
    return (
      <CenteredState
        loading
        icon="receipt-outline"
        title="Loading request"
        message="Checking the latest status and response."
      />
    );
  }

  if (!request) {
    return (
      <CenteredState
        icon="alert-circle-outline"
        title="Request unavailable"
        message="It may have been removed, or your account does not have access to it."
      />
    );
  }

  const statusCopy = STATUS_COPY[request.status];
  const contactName = role === 'customer' ? request.providerName : request.customerName;
  const contactPhone = role === 'customer' ? provider?.phone ?? '' : request.customerPhone;

  const transition = async (input: ServiceRequestTransitionInput) => {
    setBusy(true);
    const result = await transitionServiceRequest(request.id, input);
    setBusy(false);
    if (result.error) {
      Alert.alert('Could not update request', result.error);
      return false;
    }
    return true;
  };

  const sendQuote = async () => {
    const numericQuote = Number(quote);
    if (!Number.isFinite(numericQuote) || numericQuote <= 0) {
      Alert.alert('Add a valid quote', 'Enter a positive amount before sending the quote.');
      return;
    }
    const changed = await transition({
      status: 'quoted',
      quotedPrice: numericQuote,
      providerMessage: providerMessage.trim() || null,
    });
    if (changed) setQuote('');
  };

  const confirmTransition = (
    title: string,
    message: string,
    input: ServiceRequestTransitionInput
  ) => {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel' },
      {
        text: title,
        style: input.status === 'cancelled' || input.status === 'declined' ? 'destructive' : 'default',
        onPress: () => void transition(input),
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: 'Request details' }} />

      <View style={styles.statusCard}>
        <View style={styles.statusIcon}>
          <Ionicons name={statusCopy.icon as never} size={28} color={Colors.primary} />
        </View>
        <Text style={styles.eyebrow}>REQUEST STATUS</Text>
        <Text style={styles.statusTitle}>{statusCopy.label}</Text>
        <Text style={styles.statusMessage}>{statusCopy.message}</Text>
        <Text style={styles.requestDate}>Sent {formatDate(request.createdAt)}</Text>
      </View>

      <Section title={role === 'customer' ? 'Service provider' : 'Customer'} icon="person-outline">
        <View style={styles.contactRow}>
          <View style={styles.contactCopy}>
            <Text style={styles.contactName}>{contactName}</Text>
            {contactPhone ? <Text style={styles.mutedText}>{contactPhone}</Text> : null}
          </View>
          {contactPhone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Call ${contactName}`}
              onPress={() => void Linking.openURL(`tel:${contactPhone}`)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons name="call" size={19} color={Colors.primary} />
            </Pressable>
          ) : null}
          {role === 'customer' && provider ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/provider/${provider.id}`)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons name="storefront-outline" size={19} color={Colors.primary} />
            </Pressable>
          ) : null}
        </View>
      </Section>

      <Section title="Job details" icon="document-text-outline">
        <Text style={styles.bodyText}>{request.description}</Text>
        <DetailRow icon="location-outline" label="Service location" value={request.serviceAddress} />
        <DetailRow
          icon="calendar-outline"
          label="Preferred timing"
          value={request.preferredSchedule || 'Flexible'}
        />
        <DetailRow
          icon="speedometer-outline"
          label="Urgency"
          value={capitalize(request.urgency)}
        />
        <DetailRow
          icon="wallet-outline"
          label="Customer budget"
          value={
            request.budgetAmount === null
              ? 'Not specified'
              : formatMoney(request.budgetAmount, request.budgetCurrency)
          }
        />
      </Section>

      {request.quotedPrice !== null || request.providerMessage ? (
        <Section title="Provider response" icon="chatbubble-ellipses-outline">
          {request.quotedPrice !== null ? (
            <View style={styles.quoteCard}>
              <Text style={styles.quoteLabel}>QUOTED PRICE</Text>
              <Text style={styles.quoteValue}>
                {formatMoney(request.quotedPrice, request.budgetCurrency)}
              </Text>
            </View>
          ) : null}
          {request.providerMessage ? <Text style={styles.bodyText}>{request.providerMessage}</Text> : null}
        </Section>
      ) : null}

      {role === 'provider' ? (
        <ProviderActions
          request={request}
          message={providerMessage}
          quote={quote}
          busy={busy}
          onMessageChange={setProviderMessage}
          onQuoteChange={setQuote}
          onSendQuote={() => void sendQuote()}
          onTransition={(input) => void transition(input)}
          onConfirm={confirmTransition}
        />
      ) : (
        <CustomerActions
          request={request}
          busy={busy}
          onTransition={(input) => void transition(input)}
          onConfirm={confirmTransition}
        />
      )}
    </ScrollView>
  );
}

function ProviderActions({
  request,
  message,
  quote,
  busy,
  onMessageChange,
  onQuoteChange,
  onSendQuote,
  onTransition,
  onConfirm,
}: {
  request: ServiceRequest;
  message: string;
  quote: string;
  busy: boolean;
  onMessageChange: (value: string) => void;
  onQuoteChange: (value: string) => void;
  onSendQuote: () => void;
  onTransition: (input: ServiceRequestTransitionInput) => void;
  onConfirm: (title: string, message: string, input: ServiceRequestTransitionInput) => void;
}) {
  if (['completed', 'declined', 'cancelled'].includes(request.status)) return null;

  if (request.status === 'quoted') {
    return (
      <Section title="Waiting for the customer" icon="hourglass-outline">
        <Text style={styles.mutedText}>The customer can accept or decline your quote.</Text>
        <ActionButton
          label="Withdraw request"
          icon="close-circle-outline"
          tone="danger"
          busy={busy}
          onPress={() =>
            onConfirm(
              'Withdraw request',
              'This will close the request and the customer will no longer be able to accept the quote.',
              { status: 'cancelled' }
            )
          }
        />
      </Section>
    );
  }

  if (request.status === 'requested') {
    return (
      <Section title="Respond to customer" icon="paper-plane-outline">
        <TextInput
          value={message}
          onChangeText={onMessageChange}
          placeholder="Add a helpful response, availability, or questions (optional)"
          placeholderTextColor={Colors.textSubtle}
          multiline
          maxLength={1000}
          style={[styles.input, styles.messageInput]}
        />
        <View style={styles.quoteInputRow}>
          <TextInput
            value={quote}
            onChangeText={onQuoteChange}
            placeholder="Quote amount"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="decimal-pad"
            style={[styles.input, styles.quoteInput]}
          />
          <Text style={styles.currencyLabel}>{request.budgetCurrency}</Text>
        </View>
        <View style={styles.actionGrid}>
          <ActionButton
            label="Accept"
            icon="checkmark-circle-outline"
            busy={busy}
            onPress={() =>
              onTransition({ status: 'accepted', providerMessage: message.trim() || null })
            }
          />
          <ActionButton
            label="Send quote"
            icon="pricetag-outline"
            busy={busy}
            onPress={onSendQuote}
          />
        </View>
        <ActionButton
          label="Decline"
          icon="close-circle-outline"
          tone="danger"
          busy={busy}
          onPress={() =>
            onConfirm('Decline', 'Tell the customer you cannot take this request?', {
              status: 'declined',
              providerMessage: message.trim() || null,
            })
          }
        />
      </Section>
    );
  }

  if (request.status === 'accepted') {
    return (
      <Section title="Manage the job" icon="construct-outline">
        <View style={styles.actionGrid}>
          <ActionButton
            label="Mark scheduled"
            icon="calendar-outline"
            busy={busy}
            onPress={() => onTransition({ status: 'scheduled' })}
          />
          <ActionButton
            label="Start job"
            icon="play-outline"
            busy={busy}
            onPress={() => onTransition({ status: 'in_progress' })}
          />
        </View>
        <CancelAction busy={busy} onConfirm={onConfirm} />
      </Section>
    );
  }

  if (request.status === 'scheduled') {
    return (
      <Section title="Manage the job" icon="calendar-outline">
        <ActionButton
          label="Start job"
          icon="play-outline"
          busy={busy}
          onPress={() => onTransition({ status: 'in_progress' })}
        />
        <CancelAction busy={busy} onConfirm={onConfirm} />
      </Section>
    );
  }

  return (
    <Section title="Finish the job" icon="checkmark-done-outline">
      <ActionButton
        label="Mark completed"
        icon="checkmark-done-circle-outline"
        busy={busy}
        onPress={() =>
          onConfirm(
            'Mark completed',
            'Confirm that the requested service has been completed?',
            { status: 'completed' }
          )
        }
      />
      <CancelAction busy={busy} onConfirm={onConfirm} />
    </Section>
  );
}

function CustomerActions({
  request,
  busy,
  onTransition,
  onConfirm,
}: {
  request: ServiceRequest;
  busy: boolean;
  onTransition: (input: ServiceRequestTransitionInput) => void;
  onConfirm: (title: string, message: string, input: ServiceRequestTransitionInput) => void;
}) {
  if (request.status === 'quoted') {
    return (
      <Section title="Review this quote" icon="pricetag-outline">
        <ActionButton
          label="Accept quote"
          icon="checkmark-circle-outline"
          busy={busy}
          onPress={() => onTransition({ status: 'accepted' })}
        />
        <ActionButton
          label="Decline quote"
          icon="close-circle-outline"
          tone="danger"
          busy={busy}
          onPress={() =>
            onConfirm('Decline quote', 'This will close the service request.', {
              status: 'cancelled',
            })
          }
        />
      </Section>
    );
  }

  if (['requested', 'accepted', 'scheduled'].includes(request.status)) {
    return (
      <Section title="Request options" icon="options-outline">
        <ActionButton
          label="Cancel request"
          icon="close-circle-outline"
          tone="danger"
          busy={busy}
          onPress={() =>
            onConfirm(
              'Cancel request',
              'The provider will be notified that this request is no longer active.',
              { status: 'cancelled' }
            )
          }
        />
      </Section>
    );
  }

  return null;
}

function CancelAction({
  busy,
  onConfirm,
}: {
  busy: boolean;
  onConfirm: (title: string, message: string, input: ServiceRequestTransitionInput) => void;
}) {
  return (
    <ActionButton
      label="Cancel job"
      icon="close-circle-outline"
      tone="danger"
      busy={busy}
      onPress={() =>
        onConfirm('Cancel job', 'This will close the request for both you and the customer.', {
          status: 'cancelled',
        })
      }
    />
  );
}

function ActionButton({
  label,
  icon,
  tone = 'primary',
  busy,
  onPress,
}: {
  label: string;
  icon: string;
  tone?: 'primary' | 'danger';
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        tone === 'danger' && styles.dangerButton,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tone === 'danger' ? Colors.danger : Colors.textOnPrimary} />
      ) : (
        <>
          <Ionicons
            name={icon as never}
            size={19}
            color={tone === 'danger' ? Colors.danger : Colors.textOnPrimary}
          />
          <Text style={[styles.actionText, tone === 'danger' && styles.dangerActionText]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Ionicons name={icon as never} size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon as never} size={17} color={Colors.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
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
    <View style={styles.centered}>
      <View style={styles.centeredIcon}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <Ionicons name={icon as never} size={34} color={Colors.primary} />
        )}
      </View>
      <Text style={styles.centeredTitle}>{title}</Text>
      <Text style={styles.centeredMessage}>{message}</Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.centeredButton, pressed && styles.pressed]}
        >
          <Text style={styles.centeredButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}

function formatMoney(value: number, currency: 'USD' | 'LBP') {
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value)} ${currency}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.md, padding: Spacing.md, paddingBottom: Spacing.xxl },
  statusCard: {
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySoft,
  },
  statusIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderRadius: 29,
    backgroundColor: Colors.surface,
  },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  statusTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900', textAlign: 'center' },
  statusMessage: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  requestDate: { color: Colors.textSubtle, fontSize: FontSize.xs, marginTop: Spacing.xs },
  section: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  contactCopy: { flex: 1, gap: 2 },
  contactName: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  mutedText: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  iconButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  bodyText: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 21 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  detailCopy: { flex: 1, gap: 2 },
  detailLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '800' },
  detailValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  quoteCard: { gap: 3, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.successSoft },
  quoteLabel: { color: Colors.success, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  quoteValue: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900' },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    color: Colors.text,
    backgroundColor: Colors.background,
    fontSize: FontSize.sm,
  },
  messageInput: { minHeight: 104, textAlignVertical: 'top' },
  quoteInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  quoteInput: { flex: 1 },
  currencyLabel: {
    minWidth: 54,
    color: Colors.primaryDark,
    fontSize: FontSize.sm,
    fontWeight: '900',
    textAlign: 'center',
  },
  actionGrid: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: {
    minHeight: 50,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  dangerButton: { borderWidth: 1, borderColor: Colors.danger, backgroundColor: Colors.surface },
  actionText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900', textAlign: 'center' },
  dangerActionText: { color: Colors.danger },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  centeredIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: Colors.primarySoft,
  },
  centeredTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  centeredMessage: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  centeredButton: {
    minHeight: 50,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  centeredButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
