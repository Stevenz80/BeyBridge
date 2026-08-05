import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProviderAnalytics, ProviderListingAnalytics } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type AnalyticsPayload = {
  window_days?: unknown;
  total_requests?: unknown;
  new_requests?: unknown;
  active_requests?: unknown;
  completed_requests?: unknown;
  response_rate?: unknown;
  completion_rate?: unknown;
  average_response_minutes?: unknown;
  quotes_sent?: unknown;
  quotes_accepted?: unknown;
  quote_acceptance_rate?: unknown;
  completed_value_usd?: unknown;
  completed_value_lbp?: unknown;
  listings?: unknown;
};

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mapListings(value: unknown): ProviderListingAnalytics[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.provider_id !== 'string' || typeof row.provider_name !== 'string') return [];
    return [
      {
        providerId: row.provider_id,
        providerName: row.provider_name,
        requestCount: toNumber(row.request_count),
        completedCount: toNumber(row.completed_count),
      },
    ];
  });
}

function mapAnalytics(payload: AnalyticsPayload): ProviderAnalytics {
  const averageResponseMinutes =
    payload.average_response_minutes == null
      ? null
      : toNumber(payload.average_response_minutes);

  return {
    windowDays: toNumber(payload.window_days) || 30,
    totalRequests: toNumber(payload.total_requests),
    newRequests: toNumber(payload.new_requests),
    activeRequests: toNumber(payload.active_requests),
    completedRequests: toNumber(payload.completed_requests),
    responseRate: toNumber(payload.response_rate),
    completionRate: toNumber(payload.completion_rate),
    averageResponseMinutes,
    quotesSent: toNumber(payload.quotes_sent),
    quotesAccepted: toNumber(payload.quotes_accepted),
    quoteAcceptanceRate: toNumber(payload.quote_acceptance_rate),
    completedValueUsd: toNumber(payload.completed_value_usd),
    completedValueLbp: toNumber(payload.completed_value_lbp),
    listings: mapListings(payload.listings),
  };
}

export function useProviderAnalytics(windowDays = 30) {
  const { configured, user } = useAuth();
  const [analytics, setAnalytics] = useState<ProviderAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGeneration = useRef(0);

  const refreshAnalytics = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!configured || !user) {
      setAnalytics(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const { data, error: analyticsError } = await supabase.rpc('get_provider_analytics', {
      p_window_days: windowDays,
    });

    if (generation !== loadGeneration.current) return;

    if (analyticsError) {
      setError(analyticsError.message);
    } else {
      setAnalytics(mapAnalytics((data ?? {}) as AnalyticsPayload));
      setError(null);
    }
    setLoading(false);
  }, [configured, user, windowDays]);

  useEffect(() => {
    const timeout = setTimeout(() => void refreshAnalytics(), 0);
    return () => {
      clearTimeout(timeout);
      loadGeneration.current += 1;
    };
  }, [refreshAnalytics]);

  return { analytics, loading, error, refreshAnalytics };
}
