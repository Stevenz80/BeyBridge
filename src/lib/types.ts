// lib/types.ts
// ─────────────────────────────────────────────────────────────
// Shared types. These intentionally mirror the Supabase schema
// we designed, so when we swap mock data for real queries later,
// the screens won't need to change at all.
// ─────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  nameAr: string;          // Arabic label — we'll use this when we localize
  icon: string;            // Ionicons icon name
}

export interface Provider {
  id: string;
  ownerId?: string | null;
  name: string;
  categoryId: number;
  description: string;
  address: string;
  area: string;            // neighborhood: 'Hamra', 'Achrafieh', ...
  phone: string;
  whatsapp: string;        // international format, digits only: '9613xxxxxx'
  latitude: number | null;
  longitude: number | null;
  openingHours: Record<string, string>; // { mon: '9:00–18:00', ... }
  avgRating: number;
  reviewCount: number;
  listingStatus?: ListingStatus;
  serviceMode?: ServiceMode;
  priceType?: PriceType;
  startingPrice?: number | null;
  priceCurrency?: PriceCurrency;
  yearsExperience?: number | null;
  emergencyService?: boolean;
  isVerified?: boolean;
  moderationStatus?: 'active' | 'suspended';
  moderationReason?: string;
  moderatedAt?: string | null;
}

export type ListingStatus = 'draft' | 'published' | 'paused';
export type ServiceMode = 'mobile' | 'on_site' | 'both';
export type PriceType = 'quote' | 'hourly' | 'fixed';
export type PriceCurrency = 'USD' | 'LBP';

export interface ProviderListingInput {
  categoryId: number;
  name: string;
  description: string;
  address: string;
  area: string;
  phone: string;
  whatsapp: string;
  openingHours: Record<string, string>;
  listingStatus: ListingStatus;
  serviceMode: ServiceMode;
  priceType: PriceType;
  startingPrice: number | null;
  priceCurrency: PriceCurrency;
  yearsExperience: number | null;
  emergencyService: boolean;
}

export interface Review {
  id: string;
  providerId: string;
  userId: string | null;
  userName: string;        // later this comes from profiles table
  rating: number;          // 1–5
  comment: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  phone: string;
  preferredLanguage: 'en' | 'ar';
  defaultArea: string;
  accountType: 'customer' | 'provider';
  createdAt: string;
  updatedAt: string;
}

export type ProfileUpdate = Pick<
  UserProfile,
  'fullName' | 'phone' | 'preferredLanguage' | 'defaultArea' | 'accountType'
>;

export type ServiceRequestStatus =
  | 'requested'
  | 'quoted'
  | 'accepted'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'cancelled';

export type ServiceRequestUrgency = 'standard' | 'urgent' | 'emergency';

export interface ServiceRequest {
  id: string;
  providerId: string;
  providerOwnerId: string | null;
  customerId: string;
  providerName: string;
  customerName: string;
  customerPhone: string;
  description: string;
  serviceAddress: string;
  preferredSchedule: string;
  urgency: ServiceRequestUrgency;
  budgetAmount: number | null;
  budgetCurrency: PriceCurrency;
  status: ServiceRequestStatus;
  providerMessage: string;
  quotedPrice: number | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceRequestInput {
  providerId: string;
  description: string;
  serviceAddress: string;
  preferredSchedule: string;
  urgency: ServiceRequestUrgency;
  budgetAmount: number | null;
  budgetCurrency: PriceCurrency;
}

export interface ServiceRequestTransitionInput {
  status: Exclude<ServiceRequestStatus, 'requested'>;
  providerMessage?: string | null;
  quotedPrice?: number | null;
  scheduledFor?: string | null;
}

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface VerificationRequest {
  id: string;
  providerId: string;
  providerOwnerId: string;
  providerName: string;
  businessRegistration: string;
  licenseNumber: string;
  evidenceSummary: string;
  status: VerificationStatus;
  adminNote: string;
  reviewedBy: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface VerificationRequestInput {
  providerId: string;
  businessRegistration: string;
  licenseNumber: string;
  evidenceSummary: string;
}

export interface VerificationDocument {
  id: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export type ReportTargetType = 'provider' | 'review';
export type ReportReason = 'misleading' | 'spam' | 'abuse' | 'safety' | 'fraud' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export interface ContentReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: ReportTargetType;
  providerId: string;
  reviewId: string | null;
  targetName: string;
  targetSnapshot: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  adminNote: string;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface ContentReportInput {
  targetType: ReportTargetType;
  providerId: string;
  reviewId: string | null;
  reason: ReportReason;
  details: string;
}

export interface ModerationAction {
  id: string;
  providerId: string;
  adminId: string | null;
  action: 'suspend' | 'restore';
  reason: string;
  createdAt: string;
}
