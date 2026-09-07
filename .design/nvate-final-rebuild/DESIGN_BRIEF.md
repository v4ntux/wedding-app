# Design Brief: nvate Final Platform Rebuild

## Problem

The couple can currently enter an attractive invitation studio, but the product stops feeling trustworthy at the moment that matters most. The full preview no longer uses all of their real choices, the opening ritual was replaced with cropped reference footage and a canvas cover-up, and one dark template can render as an almost empty screen. The result feels like disconnected demos rather than one finished service: create, preview, pay, and receive exactly the invitation that was designed.

The repository also contains several generations of the same idea. Valuable production work, a reviewed physical-envelope implementation, generic replacements, unused experiments, and legacy templates are mixed together. Removing everything old would break paid invitations, while keeping everything public makes the catalog noisy and inconsistent.

## Solution

Finish nvate as one coherent Telegram-first invitation platform. The Studio remains the working surface where a couple builds an invitation. Its final preview renders the same server-side invitation that will be published, using their names, date, time, place, photos, music, language, and paid options. The guest experience begins with the recovered physical envelope ceremony and continues as one uninterrupted piece of premium paper.

The public catalog contains exactly four intentionally different wedding templates: Bahor, Oqshom, Nafis, and Ipak. Existing Atlas, Marsala, and Royal templates remain renderable but hidden so historic paid links continue to work. Unused Asos and Marjon experiments are removed from the active product after dependency checks.

## Experience Principles

1. **One product over disconnected demos** -- the Studio preview, paid invitation, and template catalog must use the same renderer and the same data contract.
2. **Physical ritual over visual trickery** -- the opening must read as seal, flap, card, and handoff; no cropped foreign video, canvas patch, or unrelated cross-fade may substitute for the action.
3. **Curated clarity over accumulated features** -- keep only the four public stories and the controls required to create them, while preserving hidden compatibility where deletion would break customer data.

## Aesthetic Direction

- **Philosophy**: Tactile Ceremony -- cinematic stationery with believable paper depth, warm directional light, live typography, and restrained motion.
- **Tone**: intimate, expensive, precise, calm, emotionally warm.
- **Reference points**: the recovered August 30 physical-envelope snapshot and its approved screenshots; luxury stationery photography; Apple-level interaction restraint; couture editorial layouts; Uzbek textile craft in Ipak.
- **Anti-references**: ordinary landing pages, glass dashboards, neon gradients, generic cards, image morphing, reference footage with foreign text, full-screen canvas patches, bounce/flash effects, and templates that differ only by color.

## Existing Patterns

- **Typography**: Studio uses an editorial serif/sans pairing; templates own at most two families and use a decorative face only for couple names.
- **Colors**: Studio is black, warm gold, and paper brown. Each invitation owns a compact template-local palette. The recovered envelope engine is driven by CSS custom properties.
- **Spacing**: Studio is a linear mobile-first sequence with one active block. Invitations are continuous long-form paper with generous vertical rhythm and limited section chrome.
- **Components**: keep the current Telegram Web App shell, builder blocks, shared preview sheet, server-side template engine, map/audio/countdown blocks, template manifests, and database/payment flow. Restore the shared `envelopeExperience` component rather than duplicating opening logic.
- **Architecture**: preserve the dependency-light Node/Express/vanilla implementation because it already powers Telegram, SQLite, uploads, admin, and server rendering. The PDF's Next/React/Tailwind preference is not worth a destructive rewrite of the working product in this recovery pass.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| Studio language gate | Exists | Preserve the strong branded entry; verify both languages. |
| Studio linear builder | Modify | Keep current nine-step flow; fix preview state invalidation and completion behavior. |
| Template carousel | Modify | Show exactly four public templates with reliable static card previews. |
| Full invitation preview sheet | Modify | Render `/api/preview` HTML with real form data and the complete envelope ritual. |
| Server preview data object | Modify | Include add-ons/extras and every invitation field used by production rendering. |
| Shared physical envelope | Restore/Modify | Recover the reviewed layered paper implementation and adapt it to the current renderer. |
| Bahor invitation | Restore/Modify | Recover the bespoke botanical editorial story; keep current pricing/data contract. |
| Oqshom invitation | Restore/Modify | Recover the emerald Art Deco story and eliminate the blank glow regression. |
| Nafis invitation | Restore/Modify | Recover the burgundy couture story. |
| Ipak invitation | Restore/Modify | Recover the jade textile story. |
| Legacy Atlas/Marsala/Royal | Restore | Hidden, render-only compatibility for existing applications. |
| Asos/Marjon experiments | Remove/Hide | Zero database references; not part of the final catalog. |
| Automated smoke suite | New | Verify catalog, rendering, routes, personalization, and legacy compatibility. |

## Key Interactions

1. The couple selects a language and completes the Studio one focused block at a time.
2. Any change to invitation data invalidates the cached full preview.
3. Template cards show motion-free inner-paper previews for comparison; selecting one updates price and required-photo count.
4. The final preview POSTs the actual form to `/api/preview`, receives the server-rendered invitation, and opens it inside the Studio sheet.
5. The guest presses a native seal button. The seal releases, flap opens, card rises from the pocket, and the stage hands focus to the invitation in approximately 2.8 seconds.
6. Music starts only after the gesture and remains independently controllable.
7. The invitation reads as a continuous paper surface: names, invitation message, photo, emotional paragraph, date/time, venue/map, countdown, final message, nvate credit.
8. Submitting an order preserves the existing Telegram/admin/payment workflow; payment publishes the same chosen template.

## Responsive Behavior

- **320-599 px**: Studio fills the Telegram viewport without horizontal overflow. The envelope remains fully visible with deliberate edge cropping only for ambient decoration. Form controls and seal targets are at least 44 px.
- **600-899 px**: Studio gains breathing room without becoming a desktop dashboard. Invitations may use asymmetric two-column compositions while the paper remains readable.
- **900 px and above**: Studio is centered in a controlled work surface. Invitations expand atmosphere laterally but keep the envelope and paper at realistic proportions.
- **Short landscape viewports**: reduce stage scale and nonessential decoration; never crop the seal, names, or opening hint.
- **Card preview mode**: bypass the envelope, disable motion and audio, and fit the invitation paper cleanly inside the carousel iframe.

## Accessibility Requirements

- Native buttons for the envelope and Studio actions, complete keyboard operation, and visible focus states.
- Correct Uzbek/Russian labels and document language.
- Focus moves into the invitation after opening and never remains trapped in a hidden stage.
- Body text contrast at least 4.5:1 and large display text at least 3:1.
- `prefers-reduced-motion` keeps the explicit open action but collapses movement to a short handoff.
- No autoplay audio before user interaction.
- Main controls stay usable at 200% text zoom and on 320 px wide screens.

## Performance Requirements

- No animation dependency or new UI framework.
- Opening motion uses transform and opacity on a small fixed layer tree.
- No per-frame canvas painting, full-screen filter animation, or layout reads inside animation frames.
- Existing video may be used only as a subtle ambient background; it must not contain personalized or foreign invitation content.
- All four templates must render without console errors at 375x812, 768x1024, and 1280x800.

## Out of Scope

- Migrating the entire product to Next.js/React/Tailwind in this recovery pass.
- Adding RSVP, dress code, wishes, event schedules, galleries, accounts, or online payment.
- Deleting customer records or hidden templates referenced by existing applications.
- Replacing Telegram as the primary order and administration channel.
- Publishing or changing production infrastructure without an explicit deployment target.
