import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { REVIEWS as FALLBACK_REVIEWS } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import type { ProfileUpdate, Review, UserProfile } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type MutationResult = { error: string | null };
type RatingSummary = { average: number; count: number };

type MarketplaceContextValue = {
  profile: UserProfile | null;
  profileLoading: boolean;
  updateProfile: (updates: ProfileUpdate) => Promise<MutationResult>;
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

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const { configured, user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(FALLBACK_REVIEWS);
  const [reviewsLoading, setReviewsLoading] = useState(configured);
  const [dataError, setDataError] = useState<string | null>(null);

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

  const toggleFavorite = useCallback(
    async (providerId: string): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to save services.' };

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
    [favoriteIds, user]
  );

  const saveReview = useCallback(
    async (providerId: string, rating: number, comment: string): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to write a review.' };

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
    [profile?.fullName, reviews, user]
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
      deleteReview,
      favoriteIds,
      favoritesLoading,
      profile,
      profileLoading,
      reviews,
      reviewsByProvider,
      reviewsLoading,
      saveReview,
      toggleFavorite,
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
