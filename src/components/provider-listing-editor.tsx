import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { CATEGORIES } from '@/lib/mockData';
import type {
  ListingStatus,
  PriceCurrency,
  PriceType,
  Provider,
  ProviderListingInput,
  ServiceMode,
} from '@/lib/types';

type MutationResult = { error: string | null; provider?: Provider };

const DEFAULT_WEEKDAY_HOURS = '9:00–18:00';
const DEFAULT_SATURDAY_HOURS = '9:00–14:00';

export default function ProviderListingEditor({
  listing,
  fallbackName,
  fallbackPhone,
  fallbackArea,
  onSave,
}: {
  listing: Provider | null;
  fallbackName: string;
  fallbackPhone: string;
  fallbackArea: string;
  onSave: (input: ProviderListingInput) => Promise<MutationResult>;
}) {
  const [name, setName] = useState(listing?.name ?? fallbackName);
  const [categoryId, setCategoryId] = useState(listing?.categoryId ?? CATEGORIES[0].id);
  const [description, setDescription] = useState(listing?.description ?? '');
  const [area, setArea] = useState(listing?.area ?? fallbackArea);
  const [address, setAddress] = useState(listing?.address ?? '');
  const [latitude, setLatitude] = useState<number | null>(listing?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(listing?.longitude ?? null);
  const [phone, setPhone] = useState(listing?.phone ?? fallbackPhone);
  const [whatsapp, setWhatsapp] = useState(listing?.whatsapp ?? '');
  const [serviceMode, setServiceMode] = useState<ServiceMode>(listing?.serviceMode ?? 'mobile');
  const [priceType, setPriceType] = useState<PriceType>(listing?.priceType ?? 'quote');
  const [startingPrice, setStartingPrice] = useState(
    listing?.startingPrice == null ? '' : String(listing.startingPrice)
  );
  const [priceCurrency, setPriceCurrency] = useState<PriceCurrency>(
    listing?.priceCurrency ?? 'USD'
  );
  const [yearsExperience, setYearsExperience] = useState(
    listing?.yearsExperience == null ? '' : String(listing.yearsExperience)
  );
  const [emergencyService, setEmergencyService] = useState(listing?.emergencyService ?? false);
  const [weekdayHours, setWeekdayHours] = useState(
    listing?.openingHours.mon ?? DEFAULT_WEEKDAY_HOURS
  );
  const [saturdayHours, setSaturdayHours] = useState(
    listing?.openingHours.sat ?? DEFAULT_SATURDAY_HOURS
  );
  const [sundayHours, setSundayHours] = useState(listing?.openingHours.sun ?? 'Closed');
  const [submittingStatus, setSubmittingStatus] = useState<ListingStatus | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const {
    loading: locationLoading,
    error: locationError,
    requestLocation,
  } = useUserLocation();

  const completion = useMemo(() => {
    const checks = [
      name.trim().length >= 2,
      categoryId > 0,
      description.trim().length >= 30,
      area.trim().length >= 2,
      phone.replace(/\D/g, '').length >= 7,
      weekdayHours.trim().length > 0,
      priceType === 'quote' || Number(startingPrice) > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [area, categoryId, description, name, phone, priceType, startingPrice, weekdayHours]);

  const submit = async (listingStatus: ListingStatus) => {
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    const cleanArea = area.trim();
    const cleanPhone = phone.trim();
    const numericPrice = startingPrice.trim() ? Number(startingPrice) : null;
    const numericExperience = yearsExperience.trim() ? Number(yearsExperience) : null;

    if (cleanName.length < 2) {
      setFeedback('Add a business or professional name before saving.');
      return;
    }

    if (numericExperience !== null && (!Number.isInteger(numericExperience) || numericExperience < 0 || numericExperience > 80)) {
      setFeedback('Years of experience must be a whole number between 0 and 80.');
      return;
    }

    if (listingStatus === 'published') {
      if (cleanDescription.length < 30) {
        setFeedback('Add at least 30 characters describing what customers can expect.');
        return;
      }
      if (cleanArea.length < 2) {
        setFeedback('Add the main area where you provide this service.');
        return;
      }
      if (cleanPhone.replace(/\D/g, '').length < 7) {
        setFeedback('Add a valid phone number so customers can contact you.');
        return;
      }
      if (!weekdayHours.trim()) {
        setFeedback('Add your weekday availability before publishing.');
        return;
      }
      if (priceType !== 'quote' && (!numericPrice || numericPrice <= 0)) {
        setFeedback('Add a valid starting price, or select “Contact for quote.”');
        return;
      }
    }

    setSubmittingStatus(listingStatus);
    setFeedback(null);
    const result = await onSave({
      categoryId,
      name: cleanName,
      description: cleanDescription,
      address: address.trim(),
      area: cleanArea,
      latitude,
      longitude,
      phone: cleanPhone,
      whatsapp: whatsapp.trim(),
      openingHours: {
        mon: weekdayHours.trim(),
        tue: weekdayHours.trim(),
        wed: weekdayHours.trim(),
        thu: weekdayHours.trim(),
        fri: weekdayHours.trim(),
        sat: saturdayHours.trim() || 'Closed',
        sun: sundayHours.trim() || 'Closed',
      },
      listingStatus,
      serviceMode,
      priceType,
      startingPrice: priceType === 'quote' ? null : numericPrice,
      priceCurrency,
      yearsExperience: numericExperience,
      emergencyService,
    });
    setSubmittingStatus(null);

    if (result.error) setFeedback(result.error);
  };

  const isSubmitting = submittingStatus !== null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View style={styles.progressCopy}>
              <Text style={styles.progressEyebrow}>{listing ? 'LISTING HEALTH' : 'GET DISCOVERED'}</Text>
              <Text style={styles.progressTitle}>{completion}% ready to publish</Text>
            </View>
            <View style={styles.progressIcon}>
              <Ionicons name="storefront-outline" size={25} color={Colors.primary} />
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completion}%` }]} />
          </View>
          <Text style={styles.progressHint}>
            Clear details help customers understand the service and contact you confidently.
          </Text>
        </View>

        <FormSection
          number="1"
          title="Service basics"
          subtitle="Tell customers what you do"
          icon="construct-outline"
        >
          <FormField
            label="Business or professional name"
            value={name}
            onChangeText={setName}
            placeholder="Example: Cedar Home Repairs"
            autoCapitalize="words"
            maxLength={120}
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {CATEGORIES.map((category) => {
                const selected = category.id === categoryId;
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setCategoryId(category.id)}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      selected && styles.categoryChipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={category.icon as never}
                      size={17}
                      color={selected ? Colors.textOnPrimary : Colors.primary}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        selected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <FormField
            label="Service description"
            value={description}
            onChangeText={setDescription}
            placeholder="Explain the jobs you handle, what makes your service reliable, and what customers should expect."
            multiline
            minHeight={130}
            maxLength={2000}
            helper={`${description.trim().length}/2000 · minimum 30 characters to publish`}
          />
        </FormSection>

        <FormSection
          number="2"
          title="Where and how you work"
          subtitle="Set expectations before customers call"
          icon="location-outline"
        >
          <ChoiceGroup<ServiceMode>
            label="Service setup"
            value={serviceMode}
            onChange={setServiceMode}
            options={[
              { value: 'mobile', label: 'I travel', icon: 'car-outline' },
              { value: 'on_site', label: 'At my location', icon: 'storefront-outline' },
              { value: 'both', label: 'Both', icon: 'swap-horizontal-outline' },
            ]}
          />
          <FormField
            label="Primary service area"
            value={area}
            onChangeText={setArea}
            placeholder="Hamra, Beirut, Greater Beirut…"
            autoCapitalize="words"
            maxLength={120}
          />
          <FormField
            label={serviceMode === 'mobile' ? 'Service base or meeting point (optional)' : 'Business address'}
            value={address}
            onChangeText={setAddress}
            placeholder="Street, building, landmark…"
            autoCapitalize="words"
            maxLength={300}
          />
          <View style={styles.mapLocationCard}>
            <View style={[styles.mapLocationIcon, latitude !== null && styles.mapLocationIconReady]}>
              <Ionicons
                name={latitude !== null ? 'location' : 'location-outline'}
                size={22}
                color={latitude !== null ? Colors.success : Colors.primary}
              />
            </View>
            <View style={styles.mapLocationCopy}>
              <Text style={styles.mapLocationTitle}>
                {latitude !== null ? 'Map location added' : 'Help nearby customers find you'}
              </Text>
              <Text style={styles.mapLocationText}>
                {latitude !== null
                  ? 'Distance sorting and the Directions action will use this point.'
                  : serviceMode === 'mobile'
                    ? 'Stand at a public service base or meeting point before adding the location.'
                    : 'Stand at the business address, then add its map location.'}
              </Text>
              {locationError ? <Text style={styles.mapLocationError}>{locationError}</Text> : null}
            </View>
            <View style={styles.mapLocationActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: locationLoading }}
                disabled={locationLoading}
                onPress={() => {
                  void requestLocation().then((location) => {
                    if (!location) return;
                    setLatitude(location.latitude);
                    setLongitude(location.longitude);
                  });
                }}
                style={({ pressed }) => [styles.mapLocationButton, pressed && styles.pressed]}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.mapLocationButtonText}>
                    {latitude !== null ? 'Update' : 'Add'}
                  </Text>
                )}
              </Pressable>
              {latitude !== null ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setLatitude(null);
                    setLongitude(null);
                  }}
                  style={({ pressed }) => [styles.mapLocationButton, pressed && styles.pressed]}
                >
                  <Text style={styles.mapLocationRemoveText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <FormField
            label="Years of experience"
            value={yearsExperience}
            onChangeText={setYearsExperience}
            placeholder="Example: 5"
            keyboardType="number-pad"
            maxLength={2}
          />
          <View style={styles.switchRow}>
            <View style={styles.switchIcon}>
              <Ionicons name="flash-outline" size={21} color={Colors.primary} />
            </View>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>Emergency or same-day service</Text>
              <Text style={styles.switchText}>Show customers that urgent requests are welcome.</Text>
            </View>
            <Switch
              value={emergencyService}
              onValueChange={setEmergencyService}
              trackColor={{ false: Colors.borderStrong, true: Colors.primarySoft }}
              thumbColor={emergencyService ? Colors.primary : Colors.textSubtle}
            />
          </View>
        </FormSection>

        <FormSection
          number="3"
          title="Contact and availability"
          subtitle="Make it easy to reach you"
          icon="call-outline"
        >
          <FormField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+961…"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={30}
          />
          <FormField
            label="WhatsApp number (optional)"
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="9613…"
            helper="Include country code. Digits only are used for the WhatsApp link."
            keyboardType="phone-pad"
            maxLength={30}
          />
          <FormField
            label="Monday–Friday"
            value={weekdayHours}
            onChangeText={setWeekdayHours}
            placeholder="9:00–18:00"
            maxLength={50}
          />
          <View style={styles.twoColumnRow}>
            <View style={styles.column}>
              <FormField
                label="Saturday"
                value={saturdayHours}
                onChangeText={setSaturdayHours}
                placeholder="9:00–14:00"
                maxLength={50}
              />
            </View>
            <View style={styles.column}>
              <FormField
                label="Sunday"
                value={sundayHours}
                onChangeText={setSundayHours}
                placeholder="Closed"
                maxLength={50}
              />
            </View>
          </View>
        </FormSection>

        <FormSection
          number="4"
          title="Pricing"
          subtitle="A simple signal helps customers decide"
          icon="pricetag-outline"
        >
          <ChoiceGroup<PriceType>
            label="Pricing style"
            value={priceType}
            onChange={setPriceType}
            options={[
              { value: 'quote', label: 'Contact for quote', icon: 'chatbubble-outline' },
              { value: 'hourly', label: 'Hourly', icon: 'time-outline' },
              { value: 'fixed', label: 'Starting price', icon: 'cash-outline' },
            ]}
          />
          {priceType !== 'quote' && (
            <View style={styles.priceRow}>
              <View style={styles.priceInput}>
                <FormField
                  label={priceType === 'hourly' ? 'Hourly rate' : 'Starting from'}
                  value={startingPrice}
                  onChangeText={setStartingPrice}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  maxLength={12}
                />
              </View>
              <View style={styles.currencyGroup}>
                <Text style={styles.fieldLabel}>Currency</Text>
                <View style={styles.currencyRow}>
                  {(['USD', 'LBP'] as PriceCurrency[]).map((currency) => (
                    <Pressable
                      key={currency}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: priceCurrency === currency }}
                      onPress={() => setPriceCurrency(currency)}
                      style={({ pressed }) => [
                        styles.currencyButton,
                        priceCurrency === currency && styles.currencyButtonSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyText,
                          priceCurrency === currency && styles.currencyTextSelected,
                        ]}
                      >
                        {currency}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}
        </FormSection>

        {feedback && (
          <View style={styles.feedback}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.danger} />
            <Text selectable style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        <View style={styles.publishCard}>
          <View style={styles.publishCopy}>
            <Text style={styles.publishTitle}>Ready when you are</Text>
            <Text style={styles.publishText}>
              Drafts stay private. Publishing makes the listing searchable and open to reviews.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: submittingStatus === 'published' }}
            disabled={isSubmitting}
            onPress={() => void submit('published')}
            style={({ pressed }) => [
              styles.publishButton,
              pressed && styles.publishButtonPressed,
              isSubmitting && styles.disabled,
            ]}
          >
            {submittingStatus === 'published' ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="rocket-outline" size={20} color={Colors.textOnPrimary} />
                <Text style={styles.publishButtonText}>
                  {listing?.listingStatus === 'published' ? 'Save live listing' : 'Publish listing'}
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: submittingStatus === 'draft' }}
            disabled={isSubmitting}
            onPress={() => void submit('draft')}
            style={({ pressed }) => [
              styles.draftButton,
              pressed && styles.pressed,
              isSubmitting && styles.disabled,
            ]}
          >
            {submittingStatus === 'draft' ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={19} color={Colors.primary} />
                <Text style={styles.draftButtonText}>Save as private draft</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormSection({
  number,
  title,
  subtitle,
  icon,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionNumber}>
          <Text style={styles.sectionNumberText}>{number}</Text>
        </View>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name={icon as never} size={22} color={Colors.primary} />
      </View>
      {children}
    </View>
  );
}

function FormField({
  label,
  helper,
  minHeight,
  multiline,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  helper?: string;
  minHeight?: number;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multilineInput, minHeight ? { minHeight } : null]}
        placeholderTextColor={Colors.textSubtle}
        selectionColor={Colors.primary}
      />
      {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
    </View>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={option.icon as never}
                size={18}
                color={selected ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.md, padding: Spacing.md, paddingBottom: Spacing.xxl },
  progressCard: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  progressCopy: { flex: 1, gap: 3 },
  progressEyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  progressTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  progressIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: Radius.full, backgroundColor: Colors.surface },
  progressFill: { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.primary },
  progressHint: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  section: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionNumber: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  sectionNumberText: { color: Colors.textOnPrimary, fontSize: FontSize.xs, fontWeight: '900' },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: FontSize.xs },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  input: {
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    color: Colors.text,
    backgroundColor: Colors.background,
    fontSize: FontSize.sm,
  },
  multilineInput: { paddingTop: Spacing.md, lineHeight: 21 },
  helperText: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  categoryRow: { gap: Spacing.sm, paddingRight: Spacing.md },
  categoryChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  categoryChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  categoryChipText: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '800' },
  categoryChipTextSelected: { color: Colors.textOnPrimary },
  choiceRow: { flexDirection: 'row', gap: Spacing.sm },
  choice: {
    minHeight: 68,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  choiceSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  choiceText: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  choiceTextSelected: { color: Colors.primaryDark },
  mapLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  mapLocationIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  mapLocationIconReady: { backgroundColor: Colors.successSoft },
  mapLocationCopy: { flex: 1, gap: 2 },
  mapLocationTitle: { color: Colors.text, fontSize: FontSize.xs, fontWeight: '900' },
  mapLocationText: { color: Colors.textMuted, fontSize: 10, lineHeight: 15 },
  mapLocationError: { color: Colors.danger, fontSize: 10, lineHeight: 15 },
  mapLocationActions: { gap: Spacing.xs },
  mapLocationButton: {
    minWidth: 60,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  mapLocationButtonText: { color: Colors.primary, fontSize: 10, fontWeight: '900' },
  mapLocationRemoveText: { color: Colors.danger, fontSize: 10, fontWeight: '900' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  switchIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  switchCopy: { flex: 1, gap: 2 },
  switchTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  switchText: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  twoColumnRow: { flexDirection: 'row', gap: Spacing.sm },
  column: { flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  priceInput: { flex: 1 },
  currencyGroup: { width: 130, gap: 7 },
  currencyRow: { minHeight: 52, flexDirection: 'row', gap: 5 },
  currencyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  currencyButtonSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  currencyText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '800' },
  currencyTextSelected: { color: Colors.primaryDark },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  feedbackText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 20 },
  publishCard: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  publishCopy: { gap: 4, marginBottom: Spacing.xs },
  publishTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  publishText: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  publishButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  publishButtonPressed: { backgroundColor: Colors.primaryPressed },
  publishButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  draftButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  draftButtonText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
