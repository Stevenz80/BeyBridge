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
