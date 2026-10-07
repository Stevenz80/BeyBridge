import type { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 1, name: 'Plumbers', nameAr: 'سباكون', icon: 'water-outline' },
  { id: 2, name: 'Electricians', nameAr: 'كهربائيون', icon: 'flash-outline' },
  { id: 3, name: 'Mechanics', nameAr: 'ميكانيكيون', icon: 'car-sport-outline' },
  { id: 4, name: 'Roadside Tire Help', nameAr: 'مساعدة إطارات', icon: 'disc-outline' },
  { id: 5, name: 'Car Battery Help', nameAr: 'بطاريات سيارات', icon: 'battery-charging-outline' },
  { id: 6, name: 'Towing', nameAr: 'سحب سيارات', icon: 'car-outline' },
  { id: 7, name: 'Cleaning Services', nameAr: 'خدمات تنظيف', icon: 'sparkles-outline' },
  { id: 8, name: 'House Maintenance', nameAr: 'صيانة منزلية', icon: 'home-outline' },
  { id: 9, name: 'AC Repair', nameAr: 'تصليح مكيفات', icon: 'snow-outline' },
  { id: 10, name: 'Appliance Repair', nameAr: 'تصليح أجهزة', icon: 'build-outline' },
  { id: 11, name: 'Carpenters', nameAr: 'نجارون', icon: 'hammer-outline' },
  { id: 12, name: 'Painters', nameAr: 'دهانون', icon: 'color-palette-outline' },
  { id: 13, name: 'Locksmiths', nameAr: 'صانعو أقفال', icon: 'key-outline' },
  { id: 14, name: 'Pest Control', nameAr: 'مكافحة حشرات', icon: 'bug-outline' },
  { id: 15, name: 'Moving Services', nameAr: 'خدمات نقل', icon: 'cube-outline' },
  { id: 16, name: 'Mobile Car Wash', nameAr: 'غسيل سيارات متنقل', icon: 'car-outline' },
  { id: 17, name: 'Handyman', nameAr: 'عامل صيانة', icon: 'construct-outline' },
  { id: 18, name: 'Delivery & Errands', nameAr: 'توصيل ومشاوير', icon: 'bicycle-outline' },
  { id: 19, name: 'Phone/Laptop Repair', nameAr: 'تصليح هواتف وكمبيوتر', icon: 'phone-portrait-outline' },
  { id: 20, name: 'Laundry Services', nameAr: 'خدمات غسيل', icon: 'shirt-outline' },
];

export function getCategory(id: number): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

