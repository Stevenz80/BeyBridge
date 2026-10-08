# Whole-app UI/UX and code audit — 8 October 2026

Working branch: `fix/app-ui-ux-audit`, based on `feat/beirut-category-coverage`
(`1cd04898`). Android and iPhone are the intended platforms. No listings, payments,
backend schema or dependency versions were changed in this audit.

## Scope and evidence

Reviewed discovery/home, search, provider details, map, account/sign-in, profile,
saved services, requests, notifications, request creation, listing editing,
verification, reporting and the provider dashboard. Checked administrative form
labels and shared form/status components in code. Existing browser suites cover
customer/provider transactions, account isolation, password recovery, moderation,
blocking, deletion and public legal pages using intercepted API fixtures.

Captured 14 representative screens in both English and Arabic at 320 × 740 CSS
pixels. Browser regressions also exercise short landscape screens and existing
map/catalog checks at 320/375/412px. Intentional horizontal category rails were
distinguished from controls clipping outside their containers. These are browser
layout and behavior checks; they do not establish native gesture performance or
TalkBack/VoiceOver behavior.

## Fixes

| Confirmed issue | Change and regression coverage |
| --- | --- |
| Home map action extended beyond a 320px screen; password toggle and request-location button overflowed their rows, including Arabic layouts. | Let the logo shrink, retain 8px action spacing, and allow shared flex inputs to shrink. Password visibility has a 48 × 48 target and localized label. Tests check bounds, value preservation and navigation. |
| The Arabic profile tab label was ellipsized at 320px; tab height squeezed label boxes to 13px even with an 18px line height. | Use a compact Arabic account label with the full profile accessibility name, an 18px label line height and sufficient bar height for icons, labels and padding. Tests check rendered label space, bounds and navigation in both languages. |
| Several form controls lost a useful accessible name after a placeholder disappeared; emergency availability lacked a label. The verification submit icon was included in its accessible name. | Explicit labels on listing, report, verification and administrative note inputs, the availability switch and verification submission. Anonymous notification navigation has a button role. Tests fill labeled fields and toggle controls. |
| Subtle reading text failed normal-text contrast on light app surfaces. | Darkened the shared subtle text token; light-surface section/retry/recovery links use the darker primary token. The contrast regression checks normal-text ratios of at least 4.5:1 on white, background and soft-primary surfaces. |
| Signed-in profile load failure looked like a sign-in requirement; listing/report discovery failure looked like removed content. Verification status failure could expose a fresh submission form. | Preserve the distinction between failed loading and genuine absence, with localized retry states. Regression tests fail the API, retry and confirm the recovered form. |
| A failed request load could show “No customer requests yet” and a zero open-request count. | Dashboard shows an unavailable count and retry instead, retaining cached request cards. Tests confirm retry recovery. Customer onboarding remains reachable during discovery failure. |
| Switching provider accounts could show the previous account's performance while the new account's metrics loaded. | Reused account-scoped state for analytics, loading and errors. A delayed-response test confirms old figures disappear before new figures arrive. |
| Rapid keyboard activation could expand the map sheet twice instead of reversing an unfinished spring. | Toggle the requested detent, updating its ref synchronously, rather than checking the animation's intermediate position. A regression dispatches consecutive Enter/Space events before the spring can finish. Touch gestures retain their existing implementation. |
| An unconfigured build's account screen exposed developer environment setup instructions. Verification guidance described document uploads as unimplemented. | Offer service browsing and legal links with honest account availability copy; explain the existing private-document submission workflow. |

## Code cleanup

- Extracted the identical report/request/verification guidance into `ScreenState`.
  It scrolls on short screens and includes safe-area bottom padding; dashboard
  states retain their top safe-area wrapper.
- Extracted identical provider/request detail headings into `DetailSection`,
  preserving each screen's existing card/container styles.
- Removed the three unreferenced theme/color-scheme hooks, unused default React
  imports, obsolete profile setup/badge styles, an unused location-error style and
  translations for retired guidance. Usage was checked before deletion.
- Enabled TypeScript `noUnusedLocals` and `noUnusedParameters` to catch recurrence.
  Retained platform-specific map/native resolver files, historical migrations,
  exported recovery styles used by other routes and gated authentication flows.
- Kept the interactive custom map sheet and all existing catalog data/provenance.

## Validation

- Baseline: all **81** existing browser tests passed before changes.
- New layout/accessibility/error regressions exposed failures against the previous
  export before fixes. The analytics account-switch regression separately failed
  because the previous account's completed value remained visible.
- Expanded suite: all **100** browser tests passed after the initial fixes.
- Three fresh exports succeeded after the analytics fix and contrast adjustments.
  The full run passed **101 of 102** tests; the keyboard sheet test exposed the
  rapid-reversal bug above. A deterministic new test reproduced it before fixing.
  The subsequent targeted run passed **62 of 64** checks, including the map fixes.
  One assertion still expected the old Arabic tab text and was updated to check
  the compact label and full accessibility name. The other exposed tab-label flex
  compression despite the new line height; the bar now allows enough height.
  After the bar-height fix, all **26 affected-flow checks passed** against three
  fresh exports: all 22 UI audit cases, two map keyboard cases, Arabic shell
  localization and the real-catalog account fallback. This is a targeted final
  rerun, not a claim that the latest full suite ran entirely green in one pass.
- Reviewed eight fresh home/sign-in/request/verification captures in English and
  Arabic after the final fixes. No document overflow, clipped tab labels or page
  runtime errors were observed in these captures. Native checks remain pending.
- **12** catalog/importer tests passed; the reviewed snapshot and SQL still reproduce.
- Final strict TypeScript, full ESLint and `git diff --check` passed.
- Online `npx expo install --check` was blocked by the environment proxy's
  HTTP Forbidden response. `EXPO_OFFLINE=1 npx expo install --check` exited
  successfully, but Expo explicitly warns that offline dependency validation is
  unreliable; this does not replace the online check.

## Follow-up audit — 8 October 2026

- Reproduced a verification-document loading failure: the UI claimed no files were
  attached and allowed attachment despite an unknown existing file count, with no
  retry action. Separated load errors from mutation feedback, reused the shared
  recovery controls, suppressed the false empty state and disabled attachment
  until the document list loads. Added localized open/attach labels and English/
  Arabic regressions covering failure, retry and recovery.
- The initial follow-up full run passed **104/106**. The new document regression
  failed as expected against the pre-fix export. The other failure was a browser
  footer swipe that crossed the viewport edge and depended on event timing. The
  trace showed it moving from y=741 to y=1101 on a 915px screen. The test now checks
  a bounded upward footer drag from the resting state; all three repeats passed.
  The original header-collapse assertions remain. Native gesture code is unchanged.
- Final full regression suite: **107/107 passed** after three fresh exports,
  including English/Arabic document recovery and the map/catalog/layout checks.
  TypeScript, full ESLint, all **12** catalog/importer tests and all **4**
  release-guard/legal-export tests passed.
- Source review found no marker clustering in the native map. A Web Mercator
  projection of the 20 catalog points at the initial zoom of 11.5 (512px world
  tile, 38px marker diameter) has **20 pairs within one marker diameter**, including
  one at 5.4px. Initial auto-fit can change the settled zoom. This estimates overlap;
  it does not establish actual native rendering or performance. Confirm crowding
  and selected-marker priority in the device build
  before choosing clustering/decluttering behavior.
- Online Expo compatibility validation is still blocked: the SDK metadata request
  to `api.expo.dev/v2/sdks/57.0.0/native-modules` receives proxy CONNECT HTTP 403.
  No dependencies or lockfile entries were changed to bypass this check.
- `npm run check:play-store` still fails on missing real backend, operator/contact,
  retention, public legal URL and Android Firebase configuration. No `.env.local`,
  Supabase bindings, Android SDK or attached-device tooling is available here.
- Local SQL setup: **blocked**. Docker is available, but both the full-stack and
  supported database-only starts failed to unpack PostgreSQL with `no space left
  on device` in Docker storage while workspace storage remained available. Stopped
  both attempts and removed only the two extra images the first downloaded,
  preserving all five previously cached images. No database/container started;
  no SQL suite ran. Hosted migrations/workers remain undeployed. Use a working
  isolated local runtime or staging database for the pending backend checks.

## Remaining validation and publication work

1. Exercise physical Android release and iPhone builds: native keyboard/safe areas,
   large system text, Arabic/RTL, TalkBack/VoiceOver order and focus, reduced motion,
   permission denial, offline recovery and interruptions during form submission.
2. Profile the map in an Android release build: slow drag, flick, spring interruption,
   immediate reversal, all three sheet detents, footer drag, nested list scrolling,
   marker selection, camera padding, crowding and tile/network failure/recovery.
3. Run staging SQL/RLS suites and validate actual authentication, requests,
   analytics, verification uploads, notifications, blocking, moderation and account
   deletion. API fixtures validate client behavior; backend work remains undeployed.
4. Complete release configuration, public legal/contact details, monitoring, signed
   AAB inspection and Play Console/internal testing. The support/privacy inbox and
   operator details remain deferred owner decisions. Paid listings are also deferred.

The ordered whole-app publication plan is in [PLAY_STORE_READINESS.md](PLAY_STORE_READINESS.md).
This audit does not certify a bug-free app or native/store readiness.
