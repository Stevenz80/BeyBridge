import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { removeAllVerificationDocuments } from '@/lib/verificationDocuments';
import type {
  ContentReport,
  ContentReportInput,
  ModerationAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  VerificationRequest,
  VerificationRequestInput,
  VerificationStatus,
} from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';

type MutationResult<T = undefined> = { error: string | null; data?: T };

type TrustContextValue = {
  isAdmin: boolean;
  adminLoading: boolean;
  trustLoading: boolean;
  trustError: string | null;
  myVerificationRequests: VerificationRequest[];
  adminVerificationRequests: VerificationRequest[];
  myReports: ContentReport[];
  adminReports: ContentReport[];
  moderationActions: ModerationAction[];
  refreshTrustData: () => Promise<void>;
  submitVerification: (
    input: VerificationRequestInput
  ) => Promise<MutationResult<VerificationRequest>>;
  withdrawVerification: (id: string) => Promise<MutationResult<VerificationRequest>>;
  reviewVerification: (
    id: string,
    status: 'approved' | 'rejected',
    adminNote: string
  ) => Promise<MutationResult<VerificationRequest>>;
  submitReport: (input: ContentReportInput) => Promise<MutationResult<ContentReport>>;
  updateReportStatus: (
    id: string,
    status: Exclude<ReportStatus, 'open'>,
    adminNote: string
  ) => Promise<MutationResult<ContentReport>>;
  moderateProvider: (
    providerId: string,
    action: 'suspend' | 'restore',
    reason: string
  ) => Promise<MutationResult<ModerationAction>>;
  clearTrustError: () => void;
};

type VerificationRow = {
  id: string;
  provider_id: string;
  provider_owner_id: string;
  provider_name: string;
  business_registration: string;
  license_number: string;
  evidence_summary: string;
  status: VerificationStatus;
  admin_note: string;
  reviewed_by: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  updated_at: string;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_type: ReportTargetType;
  provider_id: string;
  review_id: string | null;
  target_name: string;
  target_snapshot: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  admin_note: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type ModerationRow = {
  id: string;
  provider_id: string;
  admin_id: string | null;
  action: 'suspend' | 'restore';
  reason: string;
  created_at: string;
};

const VERIFICATION_COLUMNS = [
  'id',
  'provider_id',
  'provider_owner_id',
  'provider_name',
  'business_registration',
  'license_number',
  'evidence_summary',
  'status',
  'admin_note',
  'reviewed_by',
  'submitted_at',
  'reviewed_at',
  'updated_at',
].join(',');

const REPORT_COLUMNS = [
  'id',
  'reporter_id',
  'reporter_name',
  'target_type',
  'provider_id',
  'review_id',
  'target_name',
  'target_snapshot',
  'reason',
  'details',
  'status',
  'admin_note',
  'reviewed_by',
  'created_at',
  'updated_at',
  'resolved_at',
].join(',');

const MODERATION_COLUMNS = 'id,provider_id,admin_id,action,reason,created_at';

const TrustContext = createContext<TrustContextValue | null>(null);

function mapVerification(row: VerificationRow): VerificationRequest {
  return {
    id: row.id,
    providerId: row.provider_id,
    providerOwnerId: row.provider_owner_id,
    providerName: row.provider_name,
    businessRegistration: row.business_registration,
    licenseNumber: row.license_number,
    evidenceSummary: row.evidence_summary,
    status: row.status,
    adminNote: row.admin_note,
    reviewedBy: row.reviewed_by,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
  };
}

function mapReport(row: ReportRow): ContentReport {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name,
    targetType: row.target_type,
    providerId: row.provider_id,
    reviewId: row.review_id,
    targetName: row.target_name,
    targetSnapshot: row.target_snapshot,
    reason: row.reason,
    details: row.details,
    status: row.status,
    adminNote: row.admin_note,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

function mapModeration(row: ModerationRow): ModerationAction {
  return {
    id: row.id,
    providerId: row.provider_id,
    adminId: row.admin_id,
    action: row.action,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export function TrustProvider({ children }: { children: React.ReactNode }) {
  const { configured, user } = useAuth();
  const { refreshProviders } = useMarketplace();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(configured);
  const [trustLoading, setTrustLoading] = useState(false);
  const [trustError, setTrustError] = useState<string | null>(null);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [moderationActions, setModerationActions] = useState<ModerationAction[]>([]);
  const loadGeneration = useRef(0);

  const refreshTrustData = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!configured || !user) {
      setIsAdmin(false);
      setVerificationRequests([]);
      setReports([]);
      setModerationActions([]);
      setAdminLoading(false);
      setTrustLoading(false);
      return;
    }

    setAdminLoading(true);
    setTrustLoading(true);

    const adminResult = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (generation !== loadGeneration.current) return;
    const nextIsAdmin = Boolean(adminResult.data);
    setIsAdmin(nextIsAdmin);
    setAdminLoading(false);

    const [verificationResult, reportsResult, moderationResult] = await Promise.all([
      supabase
        .from('provider_verification_requests')
        .select(VERIFICATION_COLUMNS)
        .order('submitted_at', { ascending: false }),
      supabase.from('reports').select(REPORT_COLUMNS).order('created_at', { ascending: false }),
      supabase
        .from('provider_moderation_actions')
        .select(MODERATION_COLUMNS)
        .order('created_at', { ascending: false }),
    ]);

    if (generation !== loadGeneration.current) return;

    const firstError =
      adminResult.error ?? verificationResult.error ?? reportsResult.error ?? moderationResult.error;
    if (firstError) {
      setTrustError(firstError.message);
    } else {
      setVerificationRequests(
        (verificationResult.data as unknown as VerificationRow[]).map(mapVerification)
      );
      setReports((reportsResult.data as unknown as ReportRow[]).map(mapReport));
      setModerationActions(
        (moderationResult.data as unknown as ModerationRow[]).map(mapModeration)
      );
      setTrustError(null);
    }
    setTrustLoading(false);
  }, [configured, user]);

  useEffect(() => {
    const timeout = setTimeout(() => void refreshTrustData(), 0);
    return () => {
      clearTimeout(timeout);
      loadGeneration.current += 1;
    };
  }, [refreshTrustData]);

  const submitVerification = useCallback(
    async (input: VerificationRequestInput): Promise<MutationResult<VerificationRequest>> => {
      if (!user) return { error: 'Sign in to request provider verification.' };

      const { data, error } = await supabase
        .from('provider_verification_requests')
        .insert({
          provider_id: input.providerId,
          business_registration: input.businessRegistration.trim(),
          license_number: input.licenseNumber.trim(),
          evidence_summary: input.evidenceSummary.trim(),
        })
        .select(VERIFICATION_COLUMNS)
        .single();

      if (error) return { error: error.message };
      const request = mapVerification(data as unknown as VerificationRow);
      setVerificationRequests((current) => [request, ...current]);
      return { error: null, data: request };
    },
    [user]
  );

  const updateVerification = useCallback(
    async (
      id: string,
      payload: { status: 'approved' | 'rejected' | 'withdrawn'; admin_note?: string }
    ): Promise<MutationResult<VerificationRequest>> => {
      const { data, error } = await supabase
        .from('provider_verification_requests')
        .update(payload)
        .eq('id', id)
        .eq('status', 'pending')
        .select(VERIFICATION_COLUMNS)
        .single();

      if (error) return { error: error.message };
      const request = mapVerification(data as unknown as VerificationRow);
      setVerificationRequests((current) =>
        current.map((item) => (item.id === request.id ? request : item))
      );
      await refreshProviders();
      return { error: null, data: request };
    },
    [refreshProviders]
  );

  const withdrawVerification = useCallback(
    async (id: string): Promise<MutationResult<VerificationRequest>> => {
      const request = verificationRequests.find((item) => item.id === id);
      if (!request) return { error: 'Verification request not found.' };

      const cleanup = await removeAllVerificationDocuments(request);
      if (cleanup.error) {
        return {
          error: `The request was not withdrawn because its private documents could not be removed: ${cleanup.error}`,
        };
      }
      return updateVerification(id, { status: 'withdrawn' });
    },
    [updateVerification, verificationRequests]
  );

  const submitReport = useCallback(
    async (input: ContentReportInput): Promise<MutationResult<ContentReport>> => {
      if (!user) return { error: 'Sign in to submit a report.' };

      const { data, error } = await supabase
        .from('reports')
        .insert({
          target_type: input.targetType,
          provider_id: input.providerId,
          review_id: input.reviewId,
          reason: input.reason,
          details: input.details.trim(),
        })
        .select(REPORT_COLUMNS)
        .single();

      if (error) return { error: error.message };
      const report = mapReport(data as unknown as ReportRow);
      setReports((current) => [report, ...current]);
      return { error: null, data: report };
    },
    [user]
  );

  const updateReportStatus = useCallback(
    async (
      id: string,
      status: Exclude<ReportStatus, 'open'>,
      adminNote: string
    ): Promise<MutationResult<ContentReport>> => {
      if (!isAdmin) return { error: 'Administrator access is required.' };

      const { data, error } = await supabase
        .from('reports')
        .update({ status, admin_note: adminNote.trim() })
        .eq('id', id)
        .in('status', ['open', 'reviewing'])
        .select(REPORT_COLUMNS)
        .single();

      if (error) return { error: error.message };
      const report = mapReport(data as unknown as ReportRow);
      setReports((current) => current.map((item) => (item.id === report.id ? report : item)));
      return { error: null, data: report };
    },
    [isAdmin]
  );

  const moderateProvider = useCallback(
    async (
      providerId: string,
      action: 'suspend' | 'restore',
      reason: string
    ): Promise<MutationResult<ModerationAction>> => {
      if (!isAdmin) return { error: 'Administrator access is required.' };

      const { data, error } = await supabase
        .from('provider_moderation_actions')
        .insert({ provider_id: providerId, action, reason: reason.trim() })
        .select(MODERATION_COLUMNS)
        .single();

      if (error) return { error: error.message };
      const moderation = mapModeration(data as unknown as ModerationRow);
      setModerationActions((current) => [moderation, ...current]);
      await refreshProviders();
      return { error: null, data: moderation };
    },
    [isAdmin, refreshProviders]
  );

  const value = useMemo<TrustContextValue>(
    () => ({
      isAdmin,
      adminLoading,
      trustLoading,
      trustError,
      myVerificationRequests: verificationRequests.filter(
        (request) => request.providerOwnerId === user?.id
      ),
      adminVerificationRequests: isAdmin ? verificationRequests : [],
      myReports: reports.filter((report) => report.reporterId === user?.id),
      adminReports: isAdmin ? reports : [],
      moderationActions,
      refreshTrustData,
      submitVerification,
      withdrawVerification,
      reviewVerification: (id, status, adminNote) =>
        updateVerification(id, { status, admin_note: adminNote }),
      submitReport,
      updateReportStatus,
      moderateProvider,
      clearTrustError: () => setTrustError(null),
    }),
    [
      adminLoading,
      isAdmin,
      moderateProvider,
      moderationActions,
      refreshTrustData,
      reports,
      submitReport,
      submitVerification,
      trustError,
      trustLoading,
      updateReportStatus,
      updateVerification,
      withdrawVerification,
      user?.id,
      verificationRequests,
    ]
  );

  return <TrustContext.Provider value={value}>{children}</TrustContext.Provider>;
}

export function useTrust() {
  const context = React.use(TrustContext);
  if (!context) throw new Error('useTrust must be used inside TrustProvider');
  return context;
}
