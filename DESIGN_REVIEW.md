# Design Review: Wedding Invitation Platform

Reviewed against: `Wedding Invitation Platform - Master Instructions.pdf`

Philosophy: cinematic luxury / physical invitation

Date: 2026-08-12

## Scope

The review covers two key experiences:

- The Telegram Mini App invitation builder at `/app/`.
- The published Oqshom invitation at `/sardor-and-kelin`, including the closed-envelope and opened-paper states.

There is no `.design/<feature>/DESIGN_BRIEF.md`, so the repository's master PDF was used as the active brief. The builder is primarily a Telegram Mini App, but the master brief explicitly requires smooth mobile and desktop behavior, so all three responsive breakpoints were assessed.

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-builder-desktop-1280.png` | Desktop (1280x800) | Builder, names step |
| `screenshots/review-builder-tablet-768.png` | Tablet (768x1024) | Builder, names step |
| `screenshots/review-builder-mobile-375.png` | Mobile (375x812) | Builder, names step |
| `screenshots/review-builder-input-focus-mobile-375.png` | Mobile (375x812) | Focused groom-name field |
| `screenshots/review-builder-validation-mobile-375.png` | Mobile (375x812) | Attempted forward navigation with incomplete step |
| `screenshots/review-invitation-envelope-desktop-1280.png` | Desktop (1280x800) | Closed Oqshom envelope, full page |
| `screenshots/review-invitation-envelope-tablet-768.png` | Tablet (768x1024) | Closed Oqshom envelope, full page |
| `screenshots/review-invitation-envelope-mobile-375.png` | Mobile (375x812) | Closed Oqshom envelope, full page |
| `screenshots/review-invitation-envelope-mobile-viewport.png` | Mobile (375x812) | Closed Oqshom envelope, viewport |
| `screenshots/review-invitation-paper-desktop-1280.png` | Desktop (1280x800) | Opened Oqshom paper, full page |
| `screenshots/review-invitation-paper-tablet-768.png` | Tablet (768x1024) | Opened Oqshom paper, full page |
| `screenshots/review-invitation-paper-mobile-375.png` | Mobile (375x812) | Opened Oqshom paper, full page |
| `screenshots/review-invitation-paper-mobile-viewport.png` | Mobile (375x812) | Opened Oqshom paper, viewport |

> Fixed elements repeat in some full-page invitation captures because the browser stitches multiple viewport frames. This is a capture artifact, not a duplicate envelope or music button in the product. The viewport captures show the real state.

## Summary

The published invitation is directionally strong: it immediately reads as a restrained, premium object rather than a generic landing page. The envelope interaction, narrow paper, typography, subdued green/champagne palette, texture, and delayed music closely follow the emotional goal of the brief.

The builder has a coherent identity of its own, but currently behaves like a polished mobile prototype placed in the middle of larger screens. Its biggest gaps are accessibility (very small labels and touch targets), desktop composition, and direct deviations from the master specification's typography and animation rules.

## Must Fix

1. **Touch targets are below the 44x44 px mobile minimum.** Runtime measurements at 375 px found the inbox control at 34x34 px, language buttons at 39x29 px, and dock step buttons at roughly 30x26 px. The CSS explicitly sets 34 px icon buttons and 28 px compact variants (`public/app/style.css:189-197`), while the language switch uses only 7 px vertical padding (`public/app/style.css:212-217`). This makes primary navigation unnecessarily difficult to tap. See `screenshots/review-builder-mobile-375.png`. _Fix: retain the small visual glyphs but expand the interactive boxes to at least 44x44 px; make each dock bead's full cell clickable._

2. **Critical builder text is too small to read comfortably.** Runtime inspection found step labels at 8.32 px, field labels and eyebrow copy at 8.96 px, and language labels at 9.6 px. These values originate from repeated `.56rem`, `.52rem`, and `.6rem` declarations (`public/app/style.css:213-215`, `public/app/style.css:268-283`, `public/app/style.css:319-323`). Letter spacing helps the visual style but does not recover legibility. _Fix: use at least 12 px for secondary labels and 14 px where comprehension or navigation depends on the text; reduce tracking slightly at mobile width._

3. **The implementation does not meet the master brief's required animation stack.** The builder and invitation use CSS keyframes/transitions (`public/app/style.css:92-179`, `public/app/style.css:294-312`, `src/blocks.js:15-40`) rather than Motion/Framer Motion. This is not merely a technology preference: orchestration, interruption, and consistent physical easing are central requirements of the brief. _Fix: if the PDF remains authoritative, migrate interaction choreography to the required Next.js/React/TypeScript/Tailwind/Motion stack or formally revise the brief._

4. **The builder violates the two-font maximum.** It loads and actively uses Prata, Golos Text, and Martian Mono (`public/app/style.css:28-30`); runtime inspection confirmed all three families render. The invitation itself correctly stays within two principal families. _Fix: remove the monospace family or fold its job into Golos Text through weight, case, and tracking._

## Should Fix

1. **Desktop and tablet layouts do not meaningfully adapt.** At 768 and 1280 px the builder remains a centered 560 px mobile column (`public/app/style.css:961-972`), producing large inactive margins and no desktop-specific hierarchy. See `screenshots/review-builder-tablet-768.png` and `screenshots/review-builder-desktop-1280.png`. _Fix: at larger widths introduce a two-zone studio: active form on the left and a sticky live invitation preview/summary on the right. Preserve the single-column mobile flow._

2. **The Oqshom paper is visually premium but reads more like a dark web panel than physical paper.** The paper uses a dark green gradient and heavy 90 px shadow (`templates/oqshom/template.html:14-18`). It succeeds aesthetically, but the master brief repeatedly emphasizes realistic paper and soft, natural lighting. See `screenshots/review-invitation-paper-mobile-viewport.png`. _Fix: add subtle fibre/noise variation inside the sheet, reduce the outer shadow density, and introduce a slight warm edge highlight so the object separates through material rather than glow._

3. **Heading hierarchy skips from H2 to H4 in template cards.** The builder uses H2 section titles followed by H4 template titles with no H3 level (`public/app/index.html` and dynamically generated template cards). _Fix: use H3 for template names or render non-heading text when these are selectable options rather than document sections._

4. **Some inputs lack accessible names.** Runtime inspection found `#music-q`, generated guest-name inputs, and hidden file inputs without associated labels or ARIA names. The visible text may provide context visually, but it does not reliably name the control for assistive technology. _Fix: associate visible labels with each field, give generated guest inputs unique IDs/labels, and add accessible names to file controls even when custom buttons trigger them._

5. **One visible builder button has no accessible name.** The runtime audit found one empty button after the form UI was generated. _Fix: identify the generated control in `public/app/app.js` and ensure it has translated text or an `aria-label` in both Uzbek and Russian._

6. **Navigation feedback for incomplete steps is too subtle.** Attempting to advance from the empty names step leaves the user on the same screen without a clear inline error in the captured state (`screenshots/review-builder-validation-mobile-375.png`). _Fix: attach a persistent, localized error message to the invalid field group, set `aria-invalid`/`aria-describedby`, and move focus to the first invalid input._

7. **Small invitation metadata is close to the practical lower limit.** The Oqshom template renders some countdown labels and footer text at roughly 9.3 px (`templates/oqshom/template.html:52-62`). Contrast is generally coherent, but mobile readability suffers. _Fix: raise metadata to 11-12 px and reduce tracking if necessary to preserve the composition._

## Could Improve

1. **Make the envelope feel more tactile.** The silhouette and seal are elegant, but the closed state is extremely low-contrast. See `screenshots/review-invitation-envelope-mobile-viewport.png`. _Suggestion: add a restrained paper-edge highlight, tiny seal relief, and slightly more differentiated flap planes while keeping the palette dark._

2. **Use the desktop canvas to strengthen anticipation.** The closed envelope is centered correctly, but it occupies a small portion of a large empty desktop field. _Suggestion: add subtle directional lighting or a very slow depth/parallax response rather than scaling the envelope aggressively._

3. **Localize utility labels fully.** Accessible labels such as `My invitations`, `Close`, `Music`, and `Steps` remain English in an Uzbek/Russian product (`public/app/index.html:43-56`, `public/app/index.html:309`, `src/blocks.js:87`). _Suggestion: provide translated ARIA strings through the same language dictionary as visible copy._

4. **Reduce one-off visual values.** The builder has a useful root token set, but still repeats hardcoded gold/dark hex values and many one-off radii/shadows. _Suggestion: promote semantic states (focus, success, error, elevated surface, compact radius) into tokens so future screens remain consistent._

5. **Validate the full invitation with representative wedding photography.** The current paid test invitation contains a fantasy landscape/character image, which overwhelms the wedding narrative in the reviewed screenshots. This is content rather than a renderer defect, but it prevents a trustworthy final aesthetic judgment. _Suggestion: keep a curated QA fixture with realistic couple photography for visual regression reviews._

## What Works Well

- The Oqshom invitation has a clear, memorable identity rather than being a recolored generic template.
- The envelope is keyboard-operable (`role="button"`, `tabindex="0"`, Enter/Space handling) and has a visible focus rule.
- Music begins only after deliberate interaction and fades in, matching the brief's audio rule (`src/blocks.js:69-75`).
- Reduced-motion handling exists in both the builder and invitation engine (`public/app/style.css:975-982`, `src/blocks.js:37-40`).
- The builder has no horizontal overflow at 375 px, its primary inputs remain 16 px, and the focused input state is visually clear. See `screenshots/review-builder-input-focus-mobile-375.png`.
- Fonts were loaded successfully during the runtime review; the screenshots do not show fallback-font layout shifts.
- The invitation maintains a single continuous paper object and follows the prescribed content order without RSVP, gallery, dress-code, or schedule clutter.
- Browser console review found no application errors on either key view. The only warnings came from Telegram's WebApp shim running outside a current Telegram host.

## Recommended Order of Work

1. Fix touch targets, tiny labels, form error feedback, and missing accessible names.
2. Decide whether the master PDF's required React/Motion stack is still binding; either migrate or update the specification explicitly.
3. Add a real tablet/desktop builder composition with live preview.
4. Refine Oqshom material realism and metadata sizing.
5. Add curated visual-regression fixtures for every invitation template at 375, 768, and 1280 px.
