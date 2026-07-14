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
  name: string;
  categoryId: number;
  description: string;
  address: string;
  area: string;            // neighborhood: 'Hamra', 'Achrafieh', ...
  phone: string;
  whatsapp: string;        // international format, digits only: '9613xxxxxx'
  latitude: number;
  longitude: number;
  openingHours: Record<string, string>; // { mon: '9:00–18:00', ... }
  avgRating: number;
  reviewCount: number;
}

export interface Review {
  id: string;
  providerId: string;
  userName: string;        // later this comes from profiles table
  rating: number;          // 1–5
  comment: string;
  createdAt: string;
}
