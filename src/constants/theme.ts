// constants/theme.ts
// ─────────────────────────────────────────────────────────────
// The single source of truth for colors, spacing, and type.
// Every screen imports from here — change a value once and the
// whole app updates. This is what keeps the design consistent.
// ─────────────────────────────────────────────────────────────

export const Colors = {
  // Brand
  navy: '#1B2A4A',        // primary — headers, key text, tab bar
  navyLight: '#2E4370',   // pressed / secondary navy
  gold: '#E8963A',        // call-to-action buttons (Call, WhatsApp, Save)
  goldSoft: '#FBEEDD',    // gold tint for chips / highlights
  teal: '#2A9D8F',        // accents — active filters, success, "Open now"
  tealSoft: '#E2F3F1',    // teal tint backgrounds

  // Surfaces
  background: '#F7F7F5',  // off-white app background
  card: '#FFFFFF',        // cards sit on the background
  border: '#E6E4DF',

  // Text
  text: '#1B2A4A',        // main text is navy — warmer than pure black
  textMuted: '#6B7280',
  textOnDark: '#FFFFFF',

  // Feedback
  star: '#F0B429',        // rating stars
  danger: '#D64545',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 26,
  hero: 32,
};
