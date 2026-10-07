# UI/UX review — 7 October 2026

Reviewed and changed the local `latest-working-version` checkout, based on `b75f22c1`.
The shared discovery flows are verified with fixture data. This is not a native device or
production release certification.

## Changes

- Anonymous visitors no longer become listing/review owners when both IDs are missing.
  Customer save/request actions remain visible, and other people's reviews are not marked “You.”
- Provider details distinguish loading/retry states from a provider that is actually unavailable.
- The bottom tab bar includes the device's bottom safe area, keeping controls above the
  iPhone home indicator and Android navigation area.
- Search inputs dismiss the keyboard on submit even when results update as the user types.
- Map results can be opened for all services. Viewport searches also produce a results panel
  without requiring a category or text query.
- Selecting a result collapses an expanded panel to reveal the map, including when selecting
  the same place again. A settled selection does not reopen a panel after a downward drag.
- Selected place cards have an explicit close control. Direct map entries have a working
  back-to-home fallback. Empty searches offer an action that actually clears the search.
- The map and fallback list use the settled panel height for bottom padding. Native place
  selection preserves a closer zoom and does not refocus merely because provider objects
  refresh. Repeated selection requests can explicitly refocus a place.
- Native camera animations respect reduced motion. Camera controls appear only after the
  interactive map is ready, rather than remaining active over a failed map's location list.
- Directions open a route, with an HTTPS fallback when Apple Maps cannot open. Link failures
  are caught. A denied location request leaves discovery usable and shows one error message.
- Arabic map headings, place counts, category descriptions, and search recovery text are localized.

## Verification

| Check | Result and scope |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| `EXPO_NO_TELEMETRY=1 npm run lint` | Passed |
| Web export | Passed |
| Playwright | All 17 tests passed again after `npm ci` (30.7s), using `/usr/bin/chromium`, including the existing 7 smoke journeys |
| Layout inspection | 17 rendered screen checks; no horizontal page overflow or JavaScript page errors |
| Android/iOS Expo export | Passed; JavaScript/Hermes bundles, not installed native apps |
| Expo dependency check | Online request blocked by HTTP proxy; offline SDK check found no mismatches, with Expo's offline-validation warning |

Browser coverage includes home/search navigation, semantic map filters, resizing and dragging
the results panel, selected-place dismissal, repeated selection, keyboard activation, an
empty search on a 320px screen, denied location, directions URL generation, Arabic, anonymous
ownership, account entry, and protected administrator routes. Directions requests are intercepted
in tests; this verifies the outgoing route URL, not Google/Apple Maps operation.

Screenshots and the layout-check results are in `output/playwright/` (ignored generated output).
Reviewed sizes are 393×852, 320×568, and 852×393, plus Arabic phone layouts.

The gesture smoke test now waits for settled panel state and the expected content opacity instead
of assuming each animation finishes within 400ms. The focused journey passed three consecutive
runs after that change, followed by the full 17-test pass. Native animation timing remains a device check.

## Still requires Android and iPhone checks

No attached device, emulator, or simulator was available. The browser uses the accessible location
list, so it cannot verify MapLibre rendering or native touch performance. Use fresh development
builds that include MapLibre; Expo Go also uses the location-list fallback.

Before signing off on Google Maps-like interaction quality, check pinch/rotate/pan, marker taps,
selection after panning, “Search this area,” recentering, map retries, slow/fast/interrupted sheet
swipes, list scrolling at each panel height, keyboard dismissal, reduced motion, large text,
Arabic/RTL, landscape, and safe areas on both platforms.

Authenticated customer/provider/admin journeys and live backend error recovery were not exercised.
The exports report the existing missing `google-services.json` configuration and optional Sentry
configuration warnings; bundle success does not establish a successful APK/IPA build.

Native marker-source inspection and a fixture-coordinate estimate identified low-zoom crowding;
see [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the assumptions and remaining map work.
