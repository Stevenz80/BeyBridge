// lib/mockData.ts
// ─────────────────────────────────────────────────────────────
// Fake-but-realistic data so we can build and polish the UI
// before touching the backend. In the Supabase step, we delete
// this file and replace it with real queries — nothing else
// in the app has to change because the shapes match lib/types.ts.
// ─────────────────────────────────────────────────────────────

import { Category, Provider, Review } from './types';

export const CATEGORIES: Category[] = [
  { id: 1, name: 'Beauty',     nameAr: 'تجميل',        icon: 'cut-outline' },
  { id: 2, name: 'Health',     nameAr: 'صحة',          icon: 'medkit-outline' },
  { id: 3, name: 'Food',       nameAr: 'مأكولات',      icon: 'restaurant-outline' },
  { id: 4, name: 'Education',  nameAr: 'تعليم',        icon: 'school-outline' },
  { id: 5, name: 'Repairs',    nameAr: 'تصليحات',      icon: 'construct-outline' },
  { id: 6, name: 'Government', nameAr: 'معاملات رسمية', icon: 'business-outline' },
  { id: 7, name: 'Fitness',    nameAr: 'لياقة',        icon: 'barbell-outline' },
  { id: 8, name: 'Shopping',   nameAr: 'تسوق',         icon: 'bag-outline' },
];

const HOURS_STANDARD = {
  mon: '9:00–18:00', tue: '9:00–18:00', wed: '9:00–18:00',
  thu: '9:00–18:00', fri: '9:00–18:00', sat: '10:00–15:00', sun: 'Closed',
};

export const PROVIDERS: Provider[] = [
  {
    id: 'p1',
    name: 'Nour Nails Studio',
    categoryId: 1,
    description:
      'Cozy nail studio in the heart of Hamra. Gel, acrylic, nail art, and classic manicures with sterilized tools and friendly staff.',
    address: 'Makdessi Street, Hamra',
    area: 'Hamra',
    phone: '+9611340000',
    whatsapp: '9613000001',
    latitude: 33.8965, longitude: 35.4805,
    openingHours: { ...HOURS_STANDARD, sun: '11:00–17:00' },
    avgRating: 4.8, reviewCount: 124,
  },
  {
    id: 'p2',
    name: 'Cedar Dental Clinic',
    categoryId: 2,
    description:
      'Family dental clinic offering cleanings, fillings, whitening, and orthodontics. English, Arabic, and French spoken.',
    address: 'Sassine Square, Achrafieh',
    area: 'Achrafieh',
    phone: '+9611200111',
    whatsapp: '9613000002',
    latitude: 33.8886, longitude: 35.5203,
    openingHours: HOURS_STANDARD,
    avgRating: 4.6, reviewCount: 89,
  },
  {
    id: 'p3',
    name: 'Em Ali Kitchen',
    categoryId: 3,
    description:
      'Home-style Lebanese cooking: daily plats du jour, mloughrabieh on Fridays, and catering for small events.',
    address: 'Mar Elias Street',
    area: 'Mar Elias',
    phone: '+9611705050',
    whatsapp: '9613000003',
    latitude: 33.8830, longitude: 35.4930,
    openingHours: { ...HOURS_STANDARD, sat: '10:00–20:00' },
    avgRating: 4.9, reviewCount: 210,
  },
  {
    id: 'p4',
    name: 'Bright Minds Tutoring',
    categoryId: 4,
    description:
      'Math, physics, and SAT prep by AUB and LAU graduates. In-person in Verdun or online. Grades 7–12.',
    address: 'Verdun Street, Concorde area',
    area: 'Verdun',
    phone: '+9611810101',
    whatsapp: '9613000004',
    latitude: 33.8790, longitude: 35.4870,
    openingHours: { ...HOURS_STANDARD, sun: '10:00–14:00' },
    avgRating: 4.7, reviewCount: 45,
  },
  {
    id: 'p5',
    name: 'Tony Electric',
    categoryId: 5,
    description:
      'Licensed electrician for home wiring, UPS and inverter installs, generator hookups, and emergency call-outs.',
    address: 'Bourj Hammoud main road',
    area: 'Bourj Hammoud',
    phone: '+9611260260',
    whatsapp: '9613000005',
    latitude: 33.8940, longitude: 35.5440,
    openingHours: { ...HOURS_STANDARD, sat: '8:00–18:00' },
    avgRating: 4.5, reviewCount: 67,
  },
  {
    id: 'p6',
    name: 'Mukhtar Office – Ras Beirut',
    categoryId: 6,
    description:
      'Official mukhtar services: ID paperwork, residency attestations, signature authentication, and civil records.',
    address: 'Bliss Street, facing AUB Main Gate',
    area: 'Ras Beirut',
    phone: '+9611350350',
    whatsapp: '9613000006',
    latitude: 33.9000, longitude: 35.4780,
    openingHours: { mon: '8:00–14:00', tue: '8:00–14:00', wed: '8:00–14:00', thu: '8:00–14:00', fri: '8:00–13:00', sat: 'Closed', sun: 'Closed' },
    avgRating: 4.1, reviewCount: 33,
  },
  {
    id: 'p7',
    name: 'Phoenix Fitness Club',
    categoryId: 7,
    description:
      'Fully equipped gym with free weights, classes (HIIT, yoga, boxing), personal training, and body composition tracking.',
    address: 'Badaro Street',
    area: 'Badaro',
    phone: '+9611390390',
    whatsapp: '9613000007',
    latitude: 33.8760, longitude: 35.5160,
    openingHours: { mon: '6:00–23:00', tue: '6:00–23:00', wed: '6:00–23:00', thu: '6:00–23:00', fri: '6:00–23:00', sat: '8:00–20:00', sun: '8:00–14:00' },
    avgRating: 4.7, reviewCount: 156,
  },
  {
    id: 'p8',
    name: 'Salon Rania',
    categoryId: 1,
    description:
      'Hair salon for cuts, color, keratin, and bridal styling. Walk-ins welcome on weekdays.',
    address: 'Gemmayzeh, Gouraud Street',
    area: 'Gemmayzeh',
    phone: '+9611444555',
    whatsapp: '9613000008',
    latitude: 33.8955, longitude: 35.5150,
    openingHours: { ...HOURS_STANDARD, mon: 'Closed' },
    avgRating: 4.4, reviewCount: 98,
  },
  {
    id: 'p9',
    name: 'Le Marché Pharmacy',
    categoryId: 2,
    description:
      'Neighborhood pharmacy with delivery, blood pressure checks, and a wide stock of chronic-illness medication.',
    address: 'Corniche el Mazraa',
    area: 'Mazraa',
    phone: '+9611666777',
    whatsapp: '9613000009',
    latitude: 33.8770, longitude: 35.4990,
    openingHours: { mon: '8:00–22:00', tue: '8:00–22:00', wed: '8:00–22:00', thu: '8:00–22:00', fri: '8:00–22:00', sat: '8:00–22:00', sun: '9:00–21:00' },
    avgRating: 4.6, reviewCount: 74,
  },
  {
    id: 'p10',
    name: 'Falafel Abou Karim',
    categoryId: 3,
    description:
      'Legendary falafel and shawarma spot since 1982. Fresh bread, secret tarator recipe, student-friendly prices.',
    address: 'Basta el Tahta',
    area: 'Basta',
    phone: '+9611888999',
    whatsapp: '9613000010',
    latitude: 33.8850, longitude: 35.5060,
    openingHours: { mon: '10:00–23:00', tue: '10:00–23:00', wed: '10:00–23:00', thu: '10:00–23:00', fri: '10:00–23:00', sat: '10:00–23:00', sun: '10:00–23:00' },
    avgRating: 4.9, reviewCount: 342,
  },
  {
    id: 'p11',
    name: 'FixIt Phone Repair',
    categoryId: 5,
    description:
      'Screen replacements, battery swaps, and water-damage recovery for all phone brands. Most repairs done same day.',
    address: 'Hamra Street, Piccadilly building',
    area: 'Hamra',
    phone: '+9611353535',
    whatsapp: '9613000011',
    latitude: 33.8958, longitude: 35.4820,
    openingHours: HOURS_STANDARD,
    avgRating: 4.3, reviewCount: 51,
  },
  {
    id: 'p12',
    name: 'Beirut Books & Stationery',
    categoryId: 8,
    description:
      'Bookshop with school supplies, art materials, printing services, and a curated Arabic and English fiction shelf.',
    address: 'Furn el Chebbak main street',
    area: 'Furn el Chebbak',
    phone: '+9611292929',
    whatsapp: '9613000012',
    latitude: 33.8690, longitude: 35.5220,
    openingHours: HOURS_STANDARD,
    avgRating: 4.5, reviewCount: 40,
  },
];

export const REVIEWS: Review[] = [
  { id: 'r1', providerId: 'p1', userName: 'Maya K.',  rating: 5, comment: 'Best gel nails in Hamra, super clean place.', createdAt: '2026-06-20' },
  { id: 'r2', providerId: 'p1', userName: 'Lara S.',  rating: 4, comment: 'Great work, slightly long wait on Saturdays.', createdAt: '2026-06-12' },
  { id: 'r3', providerId: 'p2', userName: 'Omar H.',  rating: 5, comment: 'Painless cleaning and very honest pricing.', createdAt: '2026-05-30' },
  { id: 'r4', providerId: 'p3', userName: 'Rita F.',  rating: 5, comment: 'Tastes like my grandma\u2019s cooking. The Friday mloukhieh!', createdAt: '2026-06-25' },
  { id: 'r5', providerId: 'p7', userName: 'Karim B.', rating: 4, comment: 'Good equipment, gets busy after 6pm.', createdAt: '2026-06-18' },
  { id: 'r6', providerId: 'p10', userName: 'Jad M.',  rating: 5, comment: 'The falafel sandwich is unbeatable. Go hungry.', createdAt: '2026-07-01' },
];

// Small helpers the screens use ────────────────────────────────

export function getCategory(id: number): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getReviewsFor(providerId: string): Review[] {
  return REVIEWS.filter((r) => r.providerId === providerId);
}
