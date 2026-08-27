import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import TextInput from '@/components/localized-text-input';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import KeyboardAwareScrollView from '@/components/keyboard-aware-scroll-view';
import ServiceLocationPicker, {
  type ServiceLocationSelection,
} from '@/components/service-location-picker';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import type { Coordinates } from '@/hooks/use-user-location';
import type {
  CreateServiceRequestInput,
  PriceCurrency,
  Provider,
  ServiceRequestUrgency,
} from '@/lib/types';

type Props = {
  provider: Provider;
  defaultAddress: string;
  busy: boolean;
  onSubmit: (input: CreateServiceRequestInput) => Promise<string | null>;
};

const URGENCY_OPTIONS: {
  value: ServiceRequestUrgency;
  label: string;
  description: string;
  icon: string;
}[] = [
  { value: 'standard', label: 'Standard', description: 'Flexible timing', icon: 'time-outline' },
  { value: 'urgent', label: 'Urgent', description: 'Within 24 hours', icon: 'flash-outline' },
  { value: 'emergency', label: 'Emergency', description: 'As soon as possible', icon: 'warning-outline' },
];

export default function ServiceRequestForm({ provider, defaultAddress, busy, onSubmit }: Props) {
  const [description, setDescription] = useState('');
  const [serviceAddress, setServiceAddress] = useState(defaultAddress);
  const [serviceCoordinates, setServiceCoordinates] = useState<Coordinates | null>(null);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);
  const [preferredSchedule, setPreferredSchedule] = useState('');
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>('standard');
  const [budget, setBudget] = useState('');
  const [budgetCurrency, setBudgetCurrency] = useState<PriceCurrency>(
    provider.priceCurrency ?? 'USD'
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => description.trim().length >= 20 && serviceAddress.trim().length >= 2 && !busy,
    [busy, description, serviceAddress]
  );

  const submit = async () => {
    const cleanDescription = description.trim();
    const cleanAddress = serviceAddress.trim();
    const numericBudget = budget.trim() ? Number(budget) : null;

    if (cleanDescription.length < 20) {
      setFeedback('Describe the job in at least 20 characters so the provider can respond accurately.');
      return;
    }
    if (cleanAddress.length < 2) {
      setFeedback('Add the address or area where the service is needed.');
      return;
    }
    if (numericBudget !== null && (!Number.isFinite(numericBudget) || numericBudget <= 0)) {
      setFeedback('Enter a positive budget or leave it blank.');
      return;
    }

    setFeedback(null);
    const error = await onSubmit({
      providerId: provider.id,
      description: cleanDescription,
      serviceAddress: cleanAddress,
      serviceLatitude: serviceCoordinates?.latitude ?? null,
      serviceLongitude: serviceCoordinates?.longitude ?? null,
      preferredSchedule: preferredSchedule.trim(),
      urgency,
      budgetAmount: numericBudget,
      budgetCurrency,
    });
    if (error) setFeedback(error);
  };

  const confirmMapLocation = (selection: ServiceLocationSelection) => {
    setServiceCoordinates(selection.coordinates);
    setServiceAddress(selection.address);
    setLocationFeedback('Map pin selected. Reopen the map any time to adjust it.');
    setMapPickerVisible(false);
  };

  return (
    <>
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.providerCard}>
          <View style={styles.providerIcon}>
            <Ionicons name="construct-outline" size={25} color={Colors.primary} />
          </View>
          <View style={styles.providerCopy}>
            <Text style={styles.eyebrow}>REQUESTING</Text>
            <Text style={styles.providerName}>{provider.name}</Text>
            <Text style={styles.providerArea}>{provider.area}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            icon="document-text-outline"
            title="What do you need?"
            subtitle="Specific details help the provider quote and prepare."
          />
          <Field
            label="Describe the job"
            value={description}
            onChangeText={setDescription}
            placeholder="Example: The kitchen sink is leaking under the cabinet and the valve may need replacing."
            multiline
            maxLength={2000}
            helper={`${description.trim().length}/2000 · minimum 20 characters`}
          />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Service address or area</Text>
            <View style={styles.locationRow}>
              <TextInput
                value={serviceAddress}
                onChangeText={(value) => {
                  setServiceAddress(value);
                  setServiceCoordinates(null);
                  setLocationFeedback(null);
                }}
                placeholder="Street, building, neighborhood, or landmark"
                placeholderTextColor={Colors.textSubtle}
                textContentType="fullStreetAddress"
                maxLength={300}
                style={[styles.input, styles.locationInput]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose service location on map"
                onPress={() => {
                  Keyboard.dismiss();
                  setMapPickerVisible(true);
                }}
                style={({ pressed }) => [
                  styles.locationButton,
                  serviceCoordinates && styles.locationButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={serviceCoordinates ? 'location' : 'map-outline'}
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.locationButtonText}>
                  {serviceCoordinates ? 'Adjust pin' : 'Use map'}
                </Text>
              </Pressable>
            </View>
            {locationFeedback ? (
              <View style={styles.locationStatus}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.locationSuccess}>{locationFeedback}</Text>
              </View>
            ) : (
              <Text style={styles.helper}>
                Open the map to place a pin, drag it, or use your current location.
              </Text>
            )}
          </View>
          <Field
            label="Preferred time (optional)"
            value={preferredSchedule}
            onChangeText={setPreferredSchedule}
            placeholder="Example: Friday after 3 PM"
            maxLength={200}
          />
        </View>

        <View style={styles.section}>
          <SectionHeading
            icon="speedometer-outline"
            title="How urgent is it?"
            subtitle="Choose emergency only when immediate help is genuinely needed."
          />
          <View style={styles.urgencyList}>
            {URGENCY_OPTIONS.map((option) => {
              const selected = urgency === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setUrgency(option.value)}
                  style={({ pressed }) => [
                    styles.urgencyOption,
                    selected && styles.urgencyOptionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={option.icon as never}
                    size={20}
                    color={selected ? Colors.primary : Colors.textMuted}
                  />
                  <View style={styles.urgencyCopy}>
                    <Text style={[styles.urgencyLabel, selected && styles.urgencyLabelSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.urgencyDescription}>{option.description}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? Colors.primary : Colors.textSubtle}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            icon="wallet-outline"
            title="Budget (optional)"
            subtitle="The provider can still send a different quote."
          />
          <View style={styles.budgetRow}>
            <View style={styles.budgetInput}>
              <Field
                label="Your budget"
                value={budget}
                onChangeText={setBudget}
                placeholder="Leave blank"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.currencyButtons}>
              {(['USD', 'LBP'] as const).map((currency) => (
                <Pressable
                  key={currency}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: budgetCurrency === currency }}
                  onPress={() => setBudgetCurrency(currency)}
                  style={[
                    styles.currencyButton,
                    budgetCurrency === currency && styles.currencyButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      budgetCurrency === currency && styles.currencyTextSelected,
                    ]}
                  >
                    {currency}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.notice}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
          <Text style={styles.noticeText}>
            Your profile name and phone number will be shared only with this provider so they can
            respond to the request.
          </Text>
        </View>

        {feedback ? (
          <View style={styles.feedback}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy }}
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <>
              <Text style={styles.submitText}>Send service request</Text>
              <Ionicons name="arrow-forward" size={19} color={Colors.textOnPrimary} />
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollView>

      {mapPickerVisible ? (
        <ServiceLocationPicker
          initialAddress={serviceAddress}
          initialCoordinates={serviceCoordinates}
          onClose={() => setMapPickerVisible(false)}
          onConfirm={confirmMapLocation}
          visible
        />
      ) : null}
    </>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.smallIcon}>
        <Ionicons name={icon as never} size={19} color={Colors.primary} />
      </View>
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function Field({
  label,
  helper,
  multiline,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & { label: string; helper?: string }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      </View>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={Colors.textSubtle}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.md, padding: Spacing.md, paddingBottom: Spacing.xxl },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  providerIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  providerCopy: { flex: 1, gap: 2 },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  providerName: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  providerArea: { color: Colors.textMuted, fontSize: FontSize.xs },
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
  smallIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  sectionHeadingCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  field: { gap: 7 },
  fieldLabelRow: { gap: 2 },
  fieldLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  helper: { color: Colors.textMuted, fontSize: 10 },
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
  locationRow: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.sm },
  locationInput: { flex: 1 },
  locationButton: {
    width: 88,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  locationButtonSelected: { borderColor: Colors.primary },
  locationButtonText: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900' },
  locationStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  locationSuccess: { flex: 1, color: Colors.success, fontSize: FontSize.xs, lineHeight: 18 },
  locationError: { flex: 1, color: Colors.danger, fontSize: FontSize.xs, lineHeight: 18 },
  multilineInput: { minHeight: 124, textAlignVertical: 'top' },
  urgencyList: { gap: Spacing.sm },
  urgencyOption: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  urgencyOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  urgencyCopy: { flex: 1, gap: 2 },
  urgencyLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  urgencyLabelSelected: { color: Colors.primaryDark },
  urgencyDescription: { color: Colors.textMuted, fontSize: FontSize.xs },
  budgetRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  budgetInput: { flex: 1 },
  currencyButtons: { flexDirection: 'row', gap: 6, paddingBottom: 1 },
  currencyButton: {
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  currencyButtonSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  currencyText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '900' },
  currencyTextSelected: { color: Colors.primaryDark },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  noticeText: { flex: 1, color: Colors.primaryDark, fontSize: FontSize.xs, lineHeight: 18 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  feedbackText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 20 },
  submitButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitText: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
