import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { PROVIDERS as CURATED_PROVIDERS, REVIEWS as FALLBACK_REVIEWS } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import type {
  ListingStatus,
  ProfileUpdate,
  Provider,
  ProviderListingInput,
  Review,
  UserProfile,
} from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type MutationResult = { error: string | null };
type ProviderMutationResult = MutationResult & { provider?: Provider };
type RatingSummary = { average: number; count: number };

type MarketplaceContextValue = {
  profile: UserProfile | null;
  profileLoading: boolean;
  updateProfile: (updates: ProfileUpdate) => Promise<MutationResult>;
  providers: Provider[];
  providersLoading: boolean;
  refreshProviders: () => Promise<void>;
  providerListings: Provider[];
  saveProviderListing: (
    listingId: string | null,
    input: ProviderListingInput
  ) => Promise<ProviderMutationResult>;
  updateProviderListingStatus: (
    listingId: string,
    status: ListingStatus
  ) => Promise<MutationResult>;
  deleteProviderListing: (listingId: string) => Promise<MutationResult>;
  favoriteIds: ReadonlySet<string>;
  favoritesLoading: boolean;
  toggleFavorite: (providerId: string) => Promise<MutationResult>;
  reviews: Review[];
  reviewsLoading: boolean;
  getReviewsForProvider: (providerId: string) => Review[];
  getRatingForProvider: (providerId: string) => RatingSummary;
  saveReview: (providerId: string, rating: number, comment: string) => Promise<MutationResult>;
  deleteReview: (reviewId: string) => Promise<MutationResult>;
  dataError: string | null;
  clearDataError: () => void;
};

type ProfileRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string;
  preferred_language: 'en' | 'ar';
  default_area: string;
  account_type: 'customer' | 'provider';
  created_at: string;
  updated_at: string;
};

type ReviewRow = {
  id: string;
  user_id: string | null;
  provider_id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
};

type ProviderRow = {
  id: string;
  owner_id: string | null;
  category_id: number;
  name: string;
  description: string;
  address: string;
  area: string;
  phone: string;
  whatsapp: string;
  latitude: number | null;
  longitude: number | null;
  opening_hours: Record<string, string>;
  is_verified: boolean;
  listing_status: 'draft' | 'published' | 'paused';
  service_mode: 'mobile' | 'on_site' | 'both';
  price_type: 'quote' | 'hourly' | 'fixed';
  starting_price: number | null;
  price_currency: 'USD' | 'LBP';
  years_experience: number | null;
  emergency_service: boolean;
  moderation_status: 'active' | 'suspended';
  moderation_reason: string;
  moderated_at: string | null;
};

const PROVIDER_COLUMNS = [
  'id',
  'owner_id',
  'category_id',
  'name',
  'description',
  'address',
  'area',
  'phone',
  'whatsapp',
  'latitude',
  'longitude',
  'opening_hours',
  'is_verified',
  'listing_status',
  'service_mode',
  'price_type',
  'starting_price',
  'price_currency',
  'years_experience',
  'emergency_service',
  'moderation_status',
  'moderation_reason',
  'moderated_at',
].join(', ');

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    preferredLanguage: row.preferred_language,
    defaultArea: row.default_area,
    accountType: row.account_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    providerId: row.provider_id,
    userId: row.user_id,
    userName: row.author_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    ownerId: row.owner_id,
    categoryId: Number(row.category_id),
    name: row.name,
    description: row.description,
    address: row.address,
    area: row.area,
    phone: row.phone,
    whatsapp: row.whatsapp,
    latitude: row.latitude,
    longitude: row.longitude,
    openingHours: row.opening_hours ?? {},
    avgRating: 0,
    reviewCount: 0,
    listingStatus: row.listing_status,
    serviceMode: row.service_mode,
    priceType: row.price_type,
    startingPrice: row.starting_price === null ? null : Number(row.starting_price),
    priceCurrency: row.price_currency,
    yearsExperience: row.years_experience,
    emergencyService: row.emergency_service,
    isVerified: row.is_verified,
    moderationStatus: row.moderation_status,
    moderationReason: row.moderation_reason,
    moderatedAt: row.moderated_at,
  };
}

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const { configured, user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [dynamicProviders, setDynamicProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(configured);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(FALLBACK_REVIEWS);
  const [reviewsLoading, setReviewsLoading] = useState(configured);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadProviderData = useCallback(async () => {
    if (!configured) {
      setDynamicProviders([]);
      setProvidersLoading(false);
      return;
    }

    setProvidersLoading(true);
    const { data, error } = await supabase
      .from('providers')
      .select(PROVIDER_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) {
      setDataError('Provider listings could not be refreshed. Please try again.');
    } else {
      setDynamicProviders((data as unknown as ProviderRow[]).map(mapProvider));
    }

    setProvidersLoading(false);
  }, [configured]);

  const loadReviews = useCallback(async () => {
    if (!configured) {
      setReviewsLoading(false);
      return;
    }

    setReviewsLoading(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('id, user_id, provider_id, author_name, rating, comment, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      setDataError('Reviews could not be refreshed. Showing the available local reviews.');
    } else {
      setReviews((data as ReviewRow[]).map(mapReview));
    }

    setReviewsLoading(false);
  }, [configured]);

  const loadAccountData = useCallback(async () => {
    if (!configured || !user) {
      setProfile(null);
      setFavoriteIds(new Set());
      setProfileLoading(false);
      setFavoritesLoading(false);
      return;
    }

    setProfileLoading(true);
    setFavoritesLoading(true);

    const [profileResult, favoritesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone, preferred_language, default_area, account_type, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.from('favorites').select('provider_id').eq('user_id', user.id),
    ]);

    if (profileResult.error) {
      setDataError('Your profile could not be loaded. Please try again.');
    } else if (profileResult.data) {
      setProfile(mapProfile(profileResult.data as ProfileRow));
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: String(user.user_metadata?.full_name ?? ''),
        })
        .select('id, full_name, avatar_url, phone, preferred_language, default_area, account_type, created_at, updated_at')
        .single();

      if (error) {
        setDataError('Your profile could not be created. Please try again.');
      } else {
        setProfile(mapProfile(data as ProfileRow));
      }
    }

    if (favoritesResult.error) {
      setDataError('Saved services could not be loaded. Please try again.');
    } else {
      setFavoriteIds(new Set((favoritesResult.data ?? []).map((row) => row.provider_id as string)));
    }

    setProfileLoading(false);
    setFavoritesLoading(false);
  }, [configured, user]);

  useEffect(() => {
    const timeout = setTimeout(() => void loadReviews(), 0);
    return () => clearTimeout(timeout);
  }, [loadReviews]);

  useEffect(() => {
    const timeout = setTimeout(() => void loadAccountData(), 0);
    return () => clearTimeout(timeout);
  }, [loadAccountData]);

  useEffect(() => {
    const timeout = setTimeout(() => void loadProviderData(), 0);
    return () => clearTimeout(timeout);
  }, [loadProviderData, user?.id]);

  const providers = useMemo(() => {
    if (!configured) return CURATED_PROVIDERS;

    return dynamicProviders.filter(
      (provider) =>
        provider.listingStatus === 'published' && provider.moderationStatus !== 'suspended'
    );
  }, [configured, dynamicProviders]);

  const providerListings = useMemo(
    () => dynamicProviders.filter((provider) => provider.ownerId === user?.id),
    [dynamicProviders, user?.id]
  );

  const updateProfile = useCallback(
    async (updates: ProfileUpdate): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to update your profile.' };

      const payload = {
        id: user.id,
        full_name: updates.fullName.trim(),
        phone: updates.phone.trim(),
        preferred_language: updates.preferredLanguage,
        default_area: updates.defaultArea.trim(),
        account_type: updates.accountType,
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
        .select('id, full_name, avatar_url, phone, preferred_language, default_area, account_type, created_at, updated_at')
        .single();

      if (error) return { error: error.message };

      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: payload.full_name },
      });

      setProfile(mapProfile(data as ProfileRow));
      return { error: authError?.message ?? null };
    },
    [user]
  );

  const saveProviderListing = useCallback(
    async (
      listingId: string | null,
      input: ProviderListingInput
    ): Promise<ProviderMutationResult> => {
      if (!user) return { error: 'Sign in to manage a service listing.' };
      if (profile?.accountType !== 'provider') {
        return { error: 'Switch your account type to Service provider before creating a listing.' };
      }

      const payload = {
        category_id: input.categoryId,
        name: input.name.trim(),
        description: input.description.trim(),
        address: input.address.trim(),
        area: input.area.trim(),
        phone: input.phone.trim(),
        whatsapp: input.whatsapp.replace(/[^0-9]/g, ''),
        opening_hours: input.openingHours,
        listing_status: input.listingStatus,
        service_mode: input.serviceMode,
        price_type: input.priceType,
        starting_price: input.priceType === 'quote' ? null : input.startingPrice,
        price_currency: input.priceCurrency,
        years_experience: input.yearsExperience,
        emergency_service: input.emergencyService,
      };

      const query = listingId
        ? supabase
            .from('providers')
            .update(payload)
            .eq('id', listingId)
            .eq('owner_id', user.id)
        : supabase.from('providers').insert({ ...payload, owner_id: user.id });

      const { data, error } = await query.select(PROVIDER_COLUMNS).single();
      if (error) return { error: error.message };

      const saved = mapProvider(data as unknown as ProviderRow);
      setDynamicProviders((current) => [
        saved,
        ...current.filter((provider) => provider.id !== saved.id),
      ]);
      return { error: null, provider: saved };
    },
    [profile?.accountType, user]
  );

  const updateProviderListingStatus = useCallback(
    async (listingId: string, status: ListingStatus): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to manage a service listing.' };

      const { data, error } = await supabase
        .from('providers')
        .update({ listing_status: status })
        .eq('id', listingId)
        .eq('owner_id', user.id)
        .select(PROVIDER_COLUMNS)
        .single();

      if (error) return { error: error.message };

      const saved = mapProvider(data as unknown as ProviderRow);
      setDynamicProviders((current) =>
        current.map((provider) => (provider.id === saved.id ? saved : provider))
      );
      return { error: null };
    },
    [user]
  );

  const deleteProviderListing = useCallback(
    async (listingId: string): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to manage a service listing.' };

      const existing = dynamicProviders.find(
        (provider) => provider.id === listingId && provider.ownerId === user.id
      );
      if (!existing) return { error: 'This listing is not available in your account.' };

      setDynamicProviders((current) => current.filter((provider) => provider.id !== listingId));
      const { error } = await supabase
        .from('providers')
        .delete()
        .eq('id', listingId)
        .eq('owner_id', user.id);

      if (error) {
        setDynamicProviders((current) => [existing, ...current]);
        return { error: error.message };
      }

      return { error: null };
    },
    [dynamicProviders, user]
  );

  const toggleFavorite = useCallback(
    async (providerId: string): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to save services.' };
      if (providers.find((provider) => provider.id === providerId)?.ownerId === user.id) {
        return { error: 'Your own listing is already available in your Business tab.' };
      }

      const wasSaved = favoriteIds.has(providerId);
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(providerId);
        else next.add(providerId);
        return next;
      });

      const result = wasSaved
        ? await supabase
            .from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('provider_id', providerId)
        : await supabase.from('favorites').insert({ user_id: user.id, provider_id: providerId });

      if (result.error) {
        setFavoriteIds((current) => {
          const rollback = new Set(current);
          if (wasSaved) rollback.add(providerId);
          else rollback.delete(providerId);
          return rollback;
        });
        return { error: result.error.message };
      }

      return { error: null };
    },
    [favoriteIds, providers, user]
  );

  const saveReview = useCallback(
    async (providerId: string, rating: number, comment: string): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to write a review.' };
      if (providers.find((provider) => provider.id === providerId)?.ownerId === user.id) {
        return { error: 'Service providers cannot review their own listing.' };
      }

      const existing = reviews.find(
        (review) => review.providerId === providerId && review.userId === user.id
      );
      const payload = {
        user_id: user.id,
        provider_id: providerId,
        author_name: profile?.fullName || String(user.user_metadata?.full_name ?? 'BeyBridge user'),
        rating,
        comment: comment.trim(),
      };

      const query = existing
        ? supabase.from('reviews').update(payload).eq('id', existing.id)
        : supabase.from('reviews').insert(payload);
      const { data, error } = await query
        .select('id, user_id, provider_id, author_name, rating, comment, created_at, updated_at')
        .single();

      if (error) return { error: error.message };

      const saved = mapReview(data as ReviewRow);
      setReviews((current) => [
        saved,
        ...current.filter((review) => review.id !== saved.id),
      ]);
      return { error: null };
    },
    [profile?.fullName, providers, reviews, user]
  );

  const deleteReview = useCallback(
    async (reviewId: string): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to manage your review.' };

      const existing = reviews.find((review) => review.id === reviewId);
      if (!existing || existing.userId !== user.id) {
        return { error: 'You can only delete your own review.' };
      }

      setReviews((current) => current.filter((review) => review.id !== reviewId));
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user.id);

      if (error) {
        setReviews((current) => [existing, ...current]);
        return { error: error.message };
      }

      return { error: null };
    },
    [reviews, user]
  );

  const reviewsByProvider = useMemo(() => {
    const grouped = new Map<string, Review[]>();
    for (const review of reviews) {
      const providerReviews = grouped.get(review.providerId) ?? [];
      providerReviews.push(review);
      grouped.set(review.providerId, providerReviews);
    }
    return grouped;
  }, [reviews]);

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      profile,
      profileLoading,
      updateProfile,
      providers,
      providersLoading,
      refreshProviders: loadProviderData,
      providerListings,
      saveProviderListing,
      updateProviderListingStatus,
      deleteProviderListing,
      favoriteIds,
      favoritesLoading,
      toggleFavorite,
      reviews,
      reviewsLoading,
      getReviewsForProvider: (providerId) => reviewsByProvider.get(providerId) ?? [],
      getRatingForProvider: (providerId) => {
        const providerReviews = reviewsByProvider.get(providerId) ?? [];
        const total = providerReviews.reduce((sum, review) => sum + review.rating, 0);
        return {
          average: providerReviews.length ? total / providerReviews.length : 0,
          count: providerReviews.length,
        };
      },
      saveReview,
      deleteReview,
      dataError,
      clearDataError: () => setDataError(null),
    }),
    [
      dataError,
      deleteProviderListing,
      deleteReview,
      favoriteIds,
      favoritesLoading,
      profile,
      profileLoading,
      providerListings,
      providers,
      providersLoading,
      loadProviderData,
      reviews,
      reviewsByProvider,
      reviewsLoading,
      saveReview,
      saveProviderListing,
      toggleFavorite,
      updateProviderListingStatus,
      updateProfile,
    ]
  );

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplace() {
  const context = React.use(MarketplaceContext);
  if (!context) throw new Error('useMarketplace must be used inside MarketplaceProvider');
  return context;
}
