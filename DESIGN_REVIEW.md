# Design Review: nvate Wedding Studio

Reviewed against: `Wedding Invitation Platform - Master Instructions.pdf` and the accumulated product direction for the Studio.

Philosophy: **Liquid Gold Atelier / Golden Thread** — cinematic black, warm gold light, editorial typography, one continuous thread and soft whole-scene motion.

Date: 2026-08-14

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-studio-language-mobile-375.png` | Mobile (375×812) | Current gold language gate |
| `screenshots/review-studio-names-mobile-375.png` | Mobile (375×812) | Current Golden Thread names block |
| `screenshots/review-builder-mobile-375.png` | Mobile (375×812) | Studio structural responsive baseline |
| `screenshots/review-builder-tablet-768.png` | Tablet (768×1024) | Studio structural responsive baseline |
| `screenshots/review-builder-desktop-1280.png` | Desktop (1280×800) | Studio structural responsive baseline |
| `screenshots/review-invitation-envelope-mobile-375.png` | Mobile (375×812) | Published invitation envelope |
| `screenshots/review-invitation-paper-mobile-viewport.png` | Mobile (375×812) | Opened invitation viewport |
| `screenshots/review-invitation-paper-tablet-768.png` | Tablet (768×1024) | Opened invitation |
| `screenshots/review-invitation-paper-desktop-1280.png` | Desktop (1280×800) | Opened invitation |

> The in-app browser blocked a second localhost navigation after the final server restart. The current language gate was captured before that restart; the retained responsive captures were used for structural comparison. Final behavior was additionally verified through server-render and static regression checks.

## Summary

The Studio now reads as one premium gold-thread experience rather than a set of unrelated form panels. The full flow keeps every next step as one card, moves it from below with blur/opacity, and now begins that reveal during the autoscroll instead of waiting for the camera to stop.

The remaining critical findings from the earlier review were fixed: minimum touch targets, readable functional labels, localized accessible names, explicit template actions, two-font system, reduced-motion support, map/no-map parity in all demos, and heading semantics.

## Must Fix

No open must-fix issues found in the reviewed frontend.

Resolved in this pass:

1. **Delayed next-block reveal** — `public/app/app.js`: scrolling and reveal now run concurrently with `Promise.all`; the complete `.blk` enters as one object.
2. **Map setting lost in template demos** — `public/app/app.js`, `src/server.js`, `src/render.js`: card and full demo now receive the selected venue name, map state and coordinates.
3. **Non-map venue looked childish/empty** — `src/blocks.js`: replaced by a large animated typographic venue scene; no building illustration remains.
4. **Tiny functional labels** — `public/app/style.css` and all five template files: increased action, switch, field, calendar, template metadata, countdown and footer sizes.
5. **Incomplete accessibility localization** — `public/app/app.js`, `src/blocks.js`: close, navigation, calendar, music, map, upload and preview labels now follow Uzbek/Russian.
6. **Incorrect template-card semantics** — cards are now `article` elements with explicit Demo/Choose buttons; clicking empty card space no longer selects by accident.

## Should Fix

No open should-fix issues found after remediation.

Resolved in this pass:

1. The time wheel now covers all 24 hours while keeping 17:00 as an unseen initial position until the user interacts.
2. The mobile calendar uses the card width more efficiently so day targets remain practical at 375 px.
3. The Studio uses only Bodoni Moda and Golos Text; technical labels retain their character through tracking rather than a third font.
4. Template footers and music/map accessibility labels are localized; decorative emoji-style glyphs were removed.
5. Template previews are non-interactive, begin their slow pan two seconds after becoming visible, and expose separate Open/Choose actions.

## Could Improve Later

1. Add a curated QA fixture with real wedding photography for each template; fantasy sample art is useful for mechanics but not ideal for final art direction decisions.
2. Add automated screenshot regression in CI for 375, 768 and 1280 px once a browser runner is part of the repository.

## What Works Well

- The Golden Thread is a clear navigation and storytelling device across the whole Studio.
- Gold scene temperatures change without breaking continuity or turning the background into a hard color switch.
- Inputs, map, music, templates, personal links and confirmation share one material language.
- The map is genuinely optional and behaves consistently in Studio, card preview, full demo and final render.
- The personal invitation motion explains the paid option visually without the former wall of text or domain upsell.
- Card preview movement is deliberately slow, starts on visibility, blocks iframe interaction and leaves selection to the explicit button.
- All five templates render in Uzbek and Russian, with and without a map, without unresolved placeholders.

## Verification

- JavaScript syntax checked for all modified JS files.
- `git diff --check` passed.
- `/api/config` returns five templates and no domain price.
- All five templates rendered in both languages and both map states (20 combinations) with no unresolved variables.
- Map-off demos contain the large venue scene; map-on demos contain the live map.
- No emoji glyphs remain in Studio/templates.
- Local server is running at `http://127.0.0.1:8080/app/`.
