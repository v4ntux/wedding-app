# nVate: Three Signature Invitations — Design & Implementation Brief

Status: implementation specification. **Do not deploy or alter production data based on this brief alone.**
Scope: REDESIGN the three most-used invitation templates and the Studio's template-selection step only. Preserve the rest of Studio.

## 0. Non-negotiable boundaries

- Do not redesign the Studio language gate, other eight steps, music picker, map, checkout, admin, auth, payments, or published routes.
- Do not delete template directories, historic applications, uploads, or existing published links.
- Work in `feat/three-templates-studio-demo`, use a draft PR and local verification. Do not merge, deploy, restart production, or change Railway without explicit approval.
- Study the current real repo before making changes. Current architecture is Node/Express + vanilla JS/CSS + server-rendered HTML templates. Reuse `src/templateStore.js`, `src/render.js`, `src/experience.js`, `public/app/app.js`, `public/app/ui.js`, `public/app/style.css`, `templates/*/manifest.json`, and existing test conventions as appropriate.
- Reference image is moodboard only. All artwork, page geometry, transitions, and composition must be original.
- Do not invent unsupported features (RSVP, dress code, online payment, gallery upload requirements) or change data fields; only implement an additional feature if the existing schema and APIs support it and the user explicitly requests it.

## 1. Select the three using actual orders, not a guess

Read the production PostgreSQL `applications` table **read-only**, returning aggregate data only. Do not expose customer records or credentials. The current public config's `populars` is useful to display popularity but the existing `templatePopularity()` counts all rows, including cancelled; it is not a substitute for the verified order report.

Suggested read-only PostgreSQL query:

```sql
SELECT template_id,
       COUNT(*) FILTER (WHERE status <> 'cancelled') AS real_orders,
       COUNT(*) FILTER (WHERE status = 'paid') AS paid_orders
FROM applications
WHERE template_id IS NOT NULL
GROUP BY template_id
ORDER BY real_orders DESC, paid_orders DESC, template_id ASC;
```

Keep only IDs that exist in `allTemplates()`. Select the top three by real non-cancelled orders, with paid orders as tie-breaker and ID as deterministic final tie-breaker. Report both counts and the selection to the user. Do not include fabricated counts, cancelled rows, or guessed winners. If fewer than three known templates have real orders, stop and request the tie/fill rule rather than silently picking zero-use templates. Do not run an apply action until the actual report is reviewed and backed up.

IMPORTANT: existing paid invitations render by stored `template_id`. Overwriting a historically sold template HTML changes those customers' pages. Prefer introducing versioned **new** template IDs (e.g. `<winning-id>-v2`) while retaining the old IDs and their assets for existing orders. Display the same customer-facing template name if appropriate. New v2 IDs become the only three selectable templates, old IDs remain renderable but hidden. Review any existing pricing visibility overrides: changing only `manifest.json` may not win over persisted `pricing.listed` settings. Ensure visibility, validation, and old draft recovery are consistent.

The already added `scripts/select-top-three-templates.js` is a preliminary utility: review and adapt it to the versioning strategy and production safety rules before using `--apply`. Its existence is NOT proof that statistics have been read or visibility changed.

## 2. Three genuinely different visual worlds

Assign the three visual directions to the verified winners in a way that respects their existing naming and visual associations, then refine each individually. Do not create the same page in three color palettes.

**A. NOCTURNE / Oqshom-like direction** (if a dark theme is selected)
- Deep emerald `#101A15`, darker black-green `#080C0A`, paper `#F0E8DA`, restrained champagne `#C5AB78`.
- Cinematic editorial composition, very large serif names, thin metallic contour, one directional glow, asymmetric portrait photo and negative space.
- A letterpress envelope with independent seal, flap, card, and fine border-draw motion.
- Hero title reveals by lines, the photo reveals behind a soft vertical crop, the divider traces independently. Tiny light glints are event-triggered, not a fullscreen perpetual particle animation.
- Date and venue arranged as a quiet monumental typographic poster; dark atmosphere does not sacrifice legibility.

**B. ATELIER / Chizgi- or Charos-like direction** (if a light graphic theme is selected)
- Ivory `#F7F3EB`, ink `#262520`, muted vermilion `#B45E4A`, pale sand `#D8CBB9`.
- High-end magazine layout, elegant oversized typographic crop, unusual editorial photo windows, strong whitespace, thin typographic grid, no standard SaaS cards.
- Off-center folded stationery opening. Name appears as two separate print lines; tiny letterspacing settles, paper edge moves once, a horizontal rule traces, then image reveals.
- Section transitions use composed horizontal and vertical reveals; do not recycle NOCTURNE's photo animation.
- Only one accent color and at most two font families. Prefer existing locally hosted Bodoni/Golos assets when suitable.

**C. BOTANICA / Gulzor- or Bahor-like direction** (if a botanical theme is selected)
- Moss `#354536`, forest `#14241C`, warm paper `#F3F0E6`, soft botanical green `#9AAD8D`.
- Botanical line art in original optimized SVG, layered handmade paper, editorial garden photography, airy asymmetry.
- Envelope opens like a folded botanical letter; a branch draws in 2–3 independent segments, small flowers unfold once, and photo masks reveal in different directions.
- Limit any idle floating to one or two offscreen-paused decoration layers; never dozens of animated petals.
- Preserve tonal separation and readability on OLED and low-quality mobile screens.

If the three verified winner IDs have other themes, define bespoke art direction for those IDs rather than silently selecting different winners. Template names, prices, and required-photo counts must come from actual manifests/config, not invented values.

## 3. Narrative structure for EACH invitation (same data contract, different composition)

1. First paint: instantly readable background and centered personalized envelope; no blank intro.
2. Personalized greeting: guest name when available, decorative signature, physically believable seal and opening hint.
3. Open gesture: native button activates seal release -> flap rotation -> paper extraction -> hero handoff; approx. 1.7–2.6s, shorter for reduced motion. Prevent duplicate gestures.
4. Hero: couple names, one dominant photograph, date, subtle independent ornament motions.
5. Invitation text / emotional statement: typographic composition specific to the theme.
6. Photo editorial: exactly the number of pictures accepted by that template, graceful handling when a demo lacks images. Never show broken placeholder boxes.
7. Date/time and countdown: timezone-correct, no reanimating all digits every second.
8. Venue/map: name/address and a working directions action; optional map stays optional and lazy-loads when practical.
9. Closing: final message, couple signature, quiet exit ornament and optional music control.
10. Small nVate credit if already present in published renderer.

Do not force additional sections unsupported by existing order data. For all three, demo, Studio preview, and published invitation must share the same renderer and data contract, with distinct demo/watermark behavior where applicable.

## 4. Motion choreography — rich detail without heavyweight rendering

A scene should feel assembled, not like every element received the same `fadeIn`.

- Each section owns its own reveal scope; entry is triggered near viewport using `IntersectionObserver`. No unconditional per-frame scroll listener.
- Use independent but coordinated timelines for the photo, line, heading, date, tiny ornament, and CTA. Overlap starts naturally; do not turn the whole page into one synchronous 30-second sequence.
- Prioritize `transform` and `opacity`. Prefer CSS keyframes/transitions and a tiny Web Animations API utility over adding Framer Motion, GSAP, Three.js, or a fullscreen canvas.
- Do not animate CSS filters, layout properties, or huge shadows across fullscreen surfaces. Use nested wrappers when two animations would otherwise overwrite the same `transform`.
- One-shot microanimations: border drawing, small icon morph, image clip reveal (check performance), seal highlight, button press, focus treatment, gentle line sweep.
- Intentional loops only: an optional subtle scroll hint and at most one or two lightweight atmospheric details when visible; pause on `visibilitychange`, iframe close, and reduced-motion.
- Timing guideline: press 120–200ms, small detail 250–500ms, text/photo 450–850ms, major scene 700–1200ms, envelope 1.7–2.6s.
- Everything readable if JS fails; avoid leaving content invisible forever because an observer never fires.
- Respect `prefers-reduced-motion`, `pointer: coarse`, keyboard/focus, and Telegram in-app browser. Music never autoplays before a user gesture.

## 5. Studio step 05 — actual preview, not fake miniature text

Screenshot shows six small, almost identical dummy covers with sample names, prices, and an eye icon. The redesigned step presents exactly three thoughtfully art-directed cards using **real previews from their real templates**. Keep the surrounding black/gold Studio identity and other steps untouched.

**Mobile UX:** one prominent preview card at a time in an accessible horizontal snap gallery with a visible peek of the next card, dots and explicit previous/next controls; alternatively a short vertically stacked list if usability testing favors it. No forced autoplay, no three running iframe previews.

**Desktop/tablet:** show all three larger portrait cards with distinct cover art, name, current price, photo requirement, selected state, and an explicit 'Open demo' control. A static poster can be derived from `/demo/:id?card=1` at build time or rendered using the same card mode; never load three full animated invitation iframes simultaneously. Do not fake the actual template using generic names-only HTML.

**Tap card or 'Open demo':** open the *existing Studio sheet*, `sheet.open({ src: '/demo/<id>?<real-supported-query>', actionLabel: localizedChooseText, onAction: () => takeTpl(tpl) })`. The actual full demo runs in one iframe INSIDE Studio with envelope gesture and normal scroll. Make this a clear, non-committing browse action. Provide close/back, visible template name, a persistent 'Choose this design' footer, focus management, and the Telegram BackButton behavior. Ensure no external tab and no loss of Studio draft or progress.

**On choose:** close sheet, then call existing `takeTpl(tpl)`; preserve its `minPhotos`, `previewHtml` invalidation, `seenInvite` reset, saved draft and progression. Confirm the selected card visibly. Handle a hidden/outdated `templateId` in existing local drafts without breaking checkout. A demo is sample content; the final personalized preview must still use `POST /api/preview` with actual order values. Never imply a demo is the purchased invitation.

**On close:** unload iframe, stop its music/loops, remove event listeners, restore body scrolling and focus, resume Studio only once. Avoid the sheet closure race. The current branch already contains an initial embedded `openDemo` change; review it, improve cleanup, and test before claiming it is complete.

## 6. Implementation sequence

1. READ actual production usage aggregates; present three winners and both counts. Do NOT change visibility yet.
2. Inventory the current code and screenshot each shortlisted original demo (375, 768, 1280 widths), including closed/open envelope and the template-selection step.
3. Create a distinct design board and motion map for each verified winner; define typography, palette, ornament vocabulary, section geometry and transition semantics.
4. Preserve historic template IDs/rendering. Introduce v2 versions if paid pages exist. Avoid changing customer pages unexpectedly.
5. Build and individually QA NOCTURNE, ATELIER, BOTANICA as appropriate to actual winners. Reuse only tiny primitives (line draw, observer, text/photo reveal); don't share visual compositions.
6. Replace Studio step-05 dummy cards with three real poster previews. Finish the in-Studio single-iframe demo and choose/close/back behavior.
7. Update listed visibility and draft fallback *only after* all three v2 templates and previews work. Persist overrides in a way that admin toggles and manifest defaults cannot accidentally reveal others.
8. Add tests: public catalog count 3; all three demos render; full preview matches published renderer; 3 template selections; hidden old paid templates still render; no external `window.open` from step 05; iframe closes/unloads; map/no-map; photo counts; UZ/RU; keyboard/reduced motion.
9. Run `npm test`, syntax/build checks, diff checks, and actual browser screenshots when a browser runner is available. Record untested cases honestly.
10. Show screenshots, motion demo, diff, performance observations, and ask for review. Production deployment remains a separate explicit approval.

## 7. Acceptance checklist

- Three *verified* popular selections, not guessed; exactly three public selectable v2 designs.
- Every invitation has its own page geometry, envelope, motifs, and animation language; not merely recolored copies.
- Real artwork/preview; no 'asd & asd', fake placeholder poster, or duplicated generic card.
- Embedded full demo inside Studio and explicit choose action; no separate browser tab.
- Existing Studio steps and payment workflow unchanged.
- Existing published/historic invitations continue to render and keep their original style wherever technically possible.
- No audible autoplay, no animation leaks, no large external libraries, no blank white screens, no broken photo/map fallbacks.
- Mobile smoothness and reduced-motion tested; no unverified claims of 60 FPS.
- No production changes without the user's explicit deployment confirmation.
