import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  CreateServiceRequestInput,
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestTransitionInput,
  ServiceRequestUrgency,
} from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type MutationResult = { error: string | null; request?: ServiceRequest };

type ServiceRequestContextValue = {
  customerRequests: ServiceRequest[];
  providerRequests: ServiceRequest[];
  loading: boolean;
  error: string | null;
  openProviderRequestCount: number;
  refreshRequests: () => Promise<void>;
  createServiceRequest: (input: CreateServiceRequestInput) => Promise<MutationResult>;
  transitionServiceRequest: (
    requestId: string,
    input: ServiceRequestTransitionInput
  ) => Promise<MutationResult>;
  acknowledgeReviewPrompt: (requestId: string) => Promise<MutationResult>;
  clearError: () => void;
};

type ServiceRequestRow = {
  id: string;
  provider_id: string;
  provider_owner_id: string | null;
  customer_id: string;
  provider_name: string;
  customer_name: string;
  customer_phone: string;
  description: string;
  service_address: string;
  service_latitude: number | null;
  service_longitude: number | null;
  preferred_schedule: string;
  urgency: ServiceRequestUrgency;
  budget_amount: number | string | null;
  budget_currency: 'USD' | 'LBP';
  status: ServiceRequestStatus;
  provider_message: string;
  quoted_price: number | string | null;
  scheduled_for: string | null;
  review_prompted_at: string | null;
  created_at: string;
  updated_at: string;
};

const REQUEST_COLUMNS = [
  'id',
  'provider_id',
  'provider_owner_id',
  'customer_id',
  'provider_name',
  'customer_name',
  'customer_phone',
  'description',
  'service_address',
  'service_latitude',
  'service_longitude',
  'preferred_schedule',
  'urgency',
  'budget_amount',
  'budget_currency',
  'status',
  'provider_message',
  'quoted_price',
  'scheduled_for',
  'review_prompted_at',
  'created_at',
  'updated_at',
].join(',');

const OPEN_STATUSES: ReadonlySet<ServiceRequestStatus> = new Set([
  'requested',
  'quoted',
  'accepted',
  'scheduled',
  'in_progress',
]);

const ServiceRequestContext = createContext<ServiceRequestContextValue | null>(null);

function toNullableNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}

function mapServiceRequest(row: ServiceRequestRow): ServiceRequest {
  return {
    id: row.id,
    providerId: row.provider_id,
    providerOwnerId: row.provider_owner_id,
    customerId: row.customer_id,
    providerName: row.provider_name,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    description: row.description,
    serviceAddress: row.service_address,
    serviceLatitude: row.service_latitude,
    serviceLongitude: row.service_longitude,
    preferredSchedule: row.preferred_schedule,
    urgency: row.urgency,
    budgetAmount: toNullableNumber(row.budget_amount),
    budgetCurrency: row.budget_currency,
    status: row.status,
    providerMessage: row.provider_message,
    quotedPrice: toNullableNumber(row.quoted_price),
    scheduledFor: row.scheduled_for,
    reviewPromptedAt: row.review_prompted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function ServiceRequestProvider({ children }: { children: React.ReactNode }) {
  const { configured, user } = useAuth();
  const [customerRequests, setCustomerRequests] = useState<ServiceRequest[]>([]);
  const [providerRequests, setProviderRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGeneration = useRef(0);

  const refreshRequests = useCallback(async () => {
    const generation = ++loadGeneration.current;

    if (!configured || !user) {
      setCustomerRequests([]);
      setProviderRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [customerResult, providerResult] = await Promise.all([
      supabase
        .from('service_requests')
        .select(REQUEST_COLUMNS)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('service_requests')
        .select(REQUEST_COLUMNS)
        .eq('provider_owner_id', user.id)
        .order('updated_at', { ascending: false }),
    ]);

    if (generation !== loadGeneration.current) return;

    if (customerResult.error || providerResult.error) {
      setError(
        customerResult.error?.message ??
          providerResult.error?.message ??
          'Service requests could not be refreshed.'
      );
    } else {
      setCustomerRequests(
        (customerResult.data as unknown as ServiceRequestRow[]).map(mapServiceRequest)
      );
      setProviderRequests(
        (providerResult.data as unknown as ServiceRequestRow[]).map(mapServiceRequest)
      );
      setError(null);
    }

    setLoading(false);
  }, [configured, user]);

  useEffect(() => {
    const timeout = setTimeout(() => void refreshRequests(), 0);
    return () => {
      clearTimeout(timeout);
      loadGeneration.current += 1;
    };
  }, [refreshRequests]);

  useEffect(() => {
    if (!configured || !user) return;

    const channel = supabase
      .channel(`service-requests:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_requests',
          filter: `customer_id=eq.${user.id}`,
        },
        () => void refreshRequests()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_requests',
          filter: `provider_owner_id=eq.${user.id}`,
        },
        () => void refreshRequests()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [configured, refreshRequests, user]);

  const createServiceRequest = useCallback(
    async (input: CreateServiceRequestInput): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to request a service.' };

      const { data, error: createError } = await supabase
        .from('service_requests')
        .insert({
          provider_id: input.providerId,
          description: input.description.trim(),
          service_address: input.serviceAddress.trim(),
          service_latitude: input.serviceLatitude,
          service_longitude: input.serviceLongitude,
          preferred_schedule: input.preferredSchedule.trim(),
          urgency: input.urgency,
          budget_amount: input.budgetAmount,
          budget_currency: input.budgetCurrency,
        })
        .select(REQUEST_COLUMNS)
        .single();

      if (createError) return { error: createError.message };

      const request = mapServiceRequest(data as unknown as ServiceRequestRow);
      setCustomerRequests((current) => [
        request,
        ...current.filter((item) => item.id !== request.id),
      ]);
      return { error: null, request };
    },
    [user]
  );

  const transitionServiceRequest = useCallback(
    async (
      requestId: string,
      input: ServiceRequestTransitionInput
    ): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to update a service request.' };

      const existing = [...customerRequests, ...providerRequests].find(
        (request) => request.id === requestId
      );
      if (!existing) return { error: 'This service request is no longer available.' };

      const payload: Record<string, string | number | null> = { status: input.status };
      if (input.providerMessage !== undefined) {
        payload.provider_message = input.providerMessage;
      }
      if (input.quotedPrice !== undefined) payload.quoted_price = input.quotedPrice;
      if (input.scheduledFor !== undefined) payload.scheduled_for = input.scheduledFor;

      const { data, error: transitionError } = await supabase
        .from('service_requests')
        .update(payload)
        .eq('id', requestId)
        .eq('status', existing.status)
        .select(REQUEST_COLUMNS)
        .single();

      if (transitionError) {
        await refreshRequests();
        return { error: transitionError.message };
      }

      const request = mapServiceRequest(data as unknown as ServiceRequestRow);
      const replaceRequest = (current: ServiceRequest[]) =>
        current.map((item) => (item.id === request.id ? request : item));
      setCustomerRequests(replaceRequest);
      setProviderRequests(replaceRequest);
      return { error: null, request };
    },
    [customerRequests, providerRequests, refreshRequests, user]
  );

  const acknowledgeReviewPrompt = useCallback(
    async (requestId: string): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to update a service request.' };

      const promptedAt = new Date().toISOString();
      const existing = customerRequests.find((request) => request.id === requestId);
      if (!existing || existing.status !== 'completed') {
        return { error: 'Only completed services can be reviewed.' };
      }
      if (existing.reviewPromptedAt) return { error: null, request: existing };

      const replacePromptedAt = (current: ServiceRequest[]) =>
        current.map((request) =>
          request.id === requestId ? { ...request, reviewPromptedAt: promptedAt } : request
        );
      setCustomerRequests(replacePromptedAt);

      const { error: updateError } = await supabase
        .from('service_requests')
        .update({ review_prompted_at: promptedAt })
        .eq('id', requestId)
        .eq('customer_id', user.id)
        .eq('status', 'completed')
        .is('review_prompted_at', null);

      if (updateError) {
        setCustomerRequests((current) =>
          current.map((request) => (request.id === requestId ? existing : request))
        );
        return { error: updateError.message };
      }

      return { error: null, request: { ...existing, reviewPromptedAt: promptedAt } };
    },
    [customerRequests, user]
  );

  const value = useMemo<ServiceRequestContextValue>(
    () => ({
      customerRequests,
      providerRequests,
      loading,
      error,
      openProviderRequestCount: providerRequests.filter((request) =>
        OPEN_STATUSES.has(request.status)
      ).length,
      refreshRequests,
      createServiceRequest,
      transitionServiceRequest,
      acknowledgeReviewPrompt,
      clearError: () => setError(null),
    }),
    [
      createServiceRequest,
      acknowledgeReviewPrompt,
      customerRequests,
      error,
      loading,
      providerRequests,
      refreshRequests,
      transitionServiceRequest,
    ]
  );

  return (
    <ServiceRequestContext.Provider value={value}>{children}</ServiceRequestContext.Provider>
  );
}

export function useServiceRequests() {
  const context = React.use(ServiceRequestContext);
  if (!context) throw new Error('useServiceRequests must be used inside ServiceRequestProvider');
  return context;
}
