import type { Category, Provider } from './types';

type ServiceIntent = {
  categoryId: number;
  label: string;
  terms: readonly string[];
  relatedCategories?: readonly {
    categoryId: number;
    weight: number;
  }[];
};

export type ServiceSearchAnalysis = {
  normalizedQuery: string;
  tokens: string[];
  categoryIds: number[];
  label: string | null;
  categoryScores: ReadonlyMap<number, number>;
};

export function getMinimumServiceSearchScore(analysis: ServiceSearchAnalysis) {
  return analysis.categoryIds.length > 0 ? 60 : 10;
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'i',
  'in',
  'me',
  'my',
  'near',
  'need',
  'of',
  'on',
  'please',
  'service',
  'someone',
  'the',
  'to',
  'with',
]);

// Search vocabulary is deliberately problem-oriented. People usually describe
// what is wrong ("flat tire" or "sink leak"), not the formal service category.
const SERVICE_INTENTS: readonly ServiceIntent[] = [
  {
    categoryId: 1,
    label: 'Plumbing',
    terms: ['plumber', 'plumbing', 'water leak', 'leaking sink', 'clogged sink', 'faucet', 'tap', 'pipe', 'drain', 'toilet', 'shower', 'water tank', 'blocked drain', 'low water pressure', 'no water', 'سباك', 'تسريب مياه', 'مغسلة مسدودة', 'ماسورة'],
    relatedCategories: [
      { categoryId: 8, weight: 0.55 },
      { categoryId: 17, weight: 0.5 },
    ],
  },
  {
    categoryId: 2,
    label: 'Electrical help',
    terms: ['electrician', 'electrical', 'electricity', 'power cut', 'no power', 'breaker', 'fuse', 'wiring', 'socket', 'outlet', 'light not working', 'inverter', 'generator', 'كهربائي', 'كهرباء', 'قاطع كهرباء', 'مولد'],
    relatedCategories: [
      { categoryId: 8, weight: 0.55 },
      { categoryId: 17, weight: 0.5 },
    ],
  },
  {
    categoryId: 3,
    label: 'Mechanics',
    terms: ['mechanic', 'garage', 'engine', 'check engine', 'brake', 'oil change', 'car repair', 'vehicle repair', 'diagnostic', 'car shaking', 'car noise', 'overheating', 'car wont start', 'ميكانيكي', 'كراج', 'محرك', 'فرامل', 'سيارة لا تعمل'],
    relatedCategories: [{ categoryId: 6, weight: 0.5 }],
  },
  {
    categoryId: 4,
    label: 'Tire & roadside help',
    terms: ['tire', 'tyre', 'flat', 'flat tire', 'puncture', 'nail in tire', 'wheel', 'tire change', 'change wheel', 'tire inflation', 'low tire pressure', 'spare tire', 'blowout', 'damaged rim', 'roadside', 'إطار', 'دولاب', 'بنشر', 'إطار مثقوب', 'تغيير إطار'],
    relatedCategories: [
      { categoryId: 3, weight: 0.82 },
      { categoryId: 6, weight: 0.58 },
    ],
  },
  {
    categoryId: 5,
    label: 'Car battery help',
    terms: ['car battery', 'dead battery', 'battery replacement', 'battery light', 'jump start', 'no crank', 'car wont start', 'vehicle wont start', 'بطارية سيارة', 'بطارية فارغة', 'اشتراك بطارية', 'السيارة لا تعمل'],
    relatedCategories: [
      { categoryId: 3, weight: 0.82 },
      { categoryId: 6, weight: 0.58 },
    ],
  },
  {
    categoryId: 6,
    label: 'Towing',
    terms: ['tow', 'towing', 'tow truck', 'breakdown', 'broken down', 'stranded car', 'stuck car', 'accident recovery', 'سطحة', 'سحب سيارة', 'سيارة عالقة', 'عطل على الطريق'],
    relatedCategories: [{ categoryId: 3, weight: 0.62 }],
  },
  {
    categoryId: 7,
    label: 'Cleaning',
    terms: ['cleaner', 'cleaning', 'deep clean', 'house cleaning', 'office cleaning', 'maid'],
  },
  {
    categoryId: 8,
    label: 'Home maintenance',
    terms: ['house maintenance', 'home maintenance', 'home repair', 'property maintenance', 'small repair', 'things to fix at home', 'صيانة منزل', 'تصليحات منزلية'],
    relatedCategories: [
      { categoryId: 17, weight: 0.9 },
      { categoryId: 1, weight: 0.52 },
      { categoryId: 2, weight: 0.52 },
    ],
  },
  {
    categoryId: 9,
    label: 'AC repair',
    terms: ['ac', 'air conditioner', 'air conditioning', 'aircon', 'not cooling', 'cooling', 'ac gas', 'ac leak', 'ac installation', 'مكيف', 'تصليح مكيف', 'المكيف لا يبرد'],
    relatedCategories: [{ categoryId: 8, weight: 0.55 }],
  },
  {
    categoryId: 10,
    label: 'Appliance repair',
    terms: ['appliance', 'washing machine', 'washer', 'dryer', 'refrigerator', 'fridge', 'freezer', 'oven', 'dishwasher', 'appliance not working', 'غسالة', 'براد', 'ثلاجة', 'فرن', 'تصليح أجهزة'],
    relatedCategories: [
      { categoryId: 2, weight: 0.6 },
      { categoryId: 17, weight: 0.55 },
    ],
  },
  {
    categoryId: 11,
    label: 'Carpentry',
    terms: ['carpenter', 'carpentry', 'woodwork', 'cabinet', 'shelf', 'furniture repair', 'wooden door'],
    relatedCategories: [{ categoryId: 17, weight: 0.65 }],
  },
  {
    categoryId: 12,
    label: 'Painting',
    terms: ['painter', 'painting', 'paint wall', 'wall paint', 'repaint', 'interior paint', 'exterior paint'],
    relatedCategories: [{ categoryId: 17, weight: 0.55 }],
  },
  {
    categoryId: 13,
    label: 'Locksmiths',
    terms: ['locksmith', 'locked out', 'lockout', 'key', 'door lock', 'lock replacement', 'key copy'],
  },
  {
    categoryId: 14,
    label: 'Pest control',
    terms: ['pest', 'insect', 'cockroach', 'roach', 'ant', 'rodent', 'rat', 'mouse', 'bed bug', 'exterminator'],
  },
  {
    categoryId: 15,
    label: 'Moving services',
    terms: ['mover', 'moving', 'move house', 'furniture moving', 'packing', 'relocation'],
    relatedCategories: [{ categoryId: 18, weight: 0.55 }],
  },
  {
    categoryId: 16,
    label: 'Mobile car wash',
    terms: ['car wash', 'vehicle wash', 'car cleaning', 'car detailing', 'mobile wash'],
    relatedCategories: [{ categoryId: 7, weight: 0.5 }],
  },
  {
    categoryId: 17,
    label: 'Handyman help',
    terms: ['handyman', 'odd job', 'small fix', 'general repair', 'install shelf', 'mount tv'],
  },
  {
    categoryId: 18,
    label: 'Delivery & errands',
    terms: ['delivery', 'courier', 'errand', 'pickup', 'drop off', 'parcel'],
  },
  {
    categoryId: 19,
    label: 'Phone & laptop repair',
    terms: ['phone repair', 'mobile repair', 'screen repair', 'laptop repair', 'computer repair', 'broken screen', 'charging port'],
  },
  {
    categoryId: 20,
    label: 'Laundry',
    terms: ['laundry', 'dry cleaning', 'clothes wash', 'ironing', 'wash clothes'],
  },
];

const INTENT_BY_CATEGORY = new Map(SERVICE_INTENTS.map((intent) => [intent.categoryId, intent]));

// Arabic is commonly typed without hamza or vowel marks, so "\u0627\u0637\u0627\u0631" must match
// "\u0625\u0637\u0627\u0631". NFD splits hamza/madda from their base letter; dropping every
// combining mark (\p{M}) keeps the base letter instead of splitting the word.
const ARABIC_LETTER_VARIANTS: Record<string, string> = { '\u0629': '\u0647', '\u0649': '\u064a' };

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0640/g, '')
    .replace(/[\u0629\u0649]/g, (letter) => ARABIC_LETTER_VARIANTS[letter])
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) & 0xf))
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function normalizeToken(token: string) {
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(value: string) {
  return normalizeSearchText(value)
    .split(' ')
    .map(normalizeToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function containsPhrase(haystack: string, phrase: string) {
  return ` ${haystack} `.includes(` ${phrase} `);
}

// Normalized once; analysis runs on every keystroke.
const NORMALIZED_INTENTS = SERVICE_INTENTS.map((intent) => ({
  intent,
  terms: intent.terms.map((term) => ({
    normalizedTerm: normalizeSearchText(term),
    termTokens: tokenize(term),
  })),
}));

export function analyzeServiceSearch(query: string): ServiceSearchAnalysis {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = tokenize(query);
  const categoryScores = new Map<number, number>();

  for (const { intent, terms } of NORMALIZED_INTENTS) {
    let score = 0;
    for (const { normalizedTerm, termTokens } of terms) {
      if (normalizedTerm && containsPhrase(normalizedQuery, normalizedTerm)) {
        score += 28 + termTokens.length * 6;
      }

      for (const token of tokens) {
        if (termTokens.includes(token)) score += 8;
      }
    }

    if (score > 0) {
      categoryScores.set(
        intent.categoryId,
        Math.max(categoryScores.get(intent.categoryId) ?? 0, score)
      );

      for (const related of intent.relatedCategories ?? []) {
        const relatedScore = Math.round(score * related.weight);
        categoryScores.set(
          related.categoryId,
          Math.max(categoryScores.get(related.categoryId) ?? 0, relatedScore)
        );
      }
    }
  }

  const topScore = Math.max(0, ...categoryScores.values());
  const categoryIds = [...categoryScores.entries()]
    .filter(([, score]) => score >= Math.max(8, topScore * 0.5))
    .sort((a, b) => b[1] - a[1])
    .map(([categoryId]) => categoryId);
  const label = categoryIds.length > 0 ? INTENT_BY_CATEGORY.get(categoryIds[0])?.label ?? null : null;

  return { normalizedQuery, tokens, categoryIds, label, categoryScores };
}

export function scoreProviderForSearch(
  provider: Provider,
  category: Category | undefined,
  analysis: ServiceSearchAnalysis
) {
  if (!analysis.normalizedQuery) return 1;
  if (analysis.tokens.length === 0 && analysis.categoryIds.length === 0) return 0;

  const names = [provider.name, ...(provider.mapSource?.names ?? [])].map(normalizeSearchText);
  const name = names.join(' ');
  const categoryName = normalizeSearchText(category?.name ?? '');
  const description = normalizeSearchText(provider.description);
  const area = normalizeSearchText(provider.area);
  const address = normalizeSearchText(provider.address);
  let score = 0;

  if (names.includes(analysis.normalizedQuery)) score += 120;
  else if (names.some((value) => containsPhrase(value, analysis.normalizedQuery))) score += 70;
  if (containsPhrase(categoryName, analysis.normalizedQuery)) score += 55;
  if (containsPhrase(description, analysis.normalizedQuery)) score += 38;
  if (containsPhrase(area, analysis.normalizedQuery)) score += 18;
  if (containsPhrase(address, analysis.normalizedQuery)) score += 12;

  const categoryIntentScore = analysis.categoryScores.get(provider.categoryId) ?? 0;
  if (categoryIntentScore > 0 && analysis.categoryIds.includes(provider.categoryId)) {
    score += 72 + categoryIntentScore;
  }

  if (analysis.tokens.length > 0) {
    const nameTokens = new Set(tokenize(name));
    const categoryTokens = new Set(tokenize(categoryName));
    const descriptionTokens = new Set(tokenize(description));
    const areaTokens = new Set(tokenize(area));
    const addressTokens = new Set(tokenize(address));
    for (const token of analysis.tokens) {
      if (nameTokens.has(token)) score += 22;
      if (categoryTokens.has(token)) score += 18;
      if (descriptionTokens.has(token)) score += 12;
      if (areaTokens.has(token)) score += 7;
      if (addressTokens.has(token)) score += 5;
    }
  }

  return score;
}
