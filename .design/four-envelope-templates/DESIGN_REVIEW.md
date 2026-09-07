# Design Review: Four Living Envelope Invitations

Reviewed against: `DESIGN_BRIEF.md`  
Review date: 2026-08-30  
Final status: **Pass — no blocker or major issues remain**

## Evidence

The review matrix covers every public template at the required viewport sizes:

| Template | 375×812 | 768×1024 | 1280×800 |
| --- | --- | --- | --- |
| Bahor | envelope + page | envelope + page | envelope + page |
| Oqshom | envelope + opening + page | envelope + page | envelope + page |
| Nafis | envelope + opening + page | envelope + page | envelope + page |
| Ipak | envelope + opening + page | envelope + page | envelope + page |

All captures are stored in `.design/four-envelope-templates/screenshots/`.

## Findings Fixed During Review

### Major — invitation card escaped below the closed envelope

- **Observed**: the tall card was translated down behind the front pocket, but its lower edge remained visible outside the envelope before interaction.
- **Fix**: added a dedicated card clipping window. It clips the card to the envelope while closed, then expands upward in sync with the card-rise animation.
- **Result**: all four closed states now show a clean sealed envelope; the card becomes visible only after the flap opens.

### Minor — Nafis stage copy lacked sufficient contrast

- **Observed**: the heading and opening hint initially inherited burgundy card ink on the burgundy velvet stage.
- **Fix**: split stage ink from card ink with `--env-ink` and `--env-card-ink`.
- **Result**: Nafis stage text now measures approximately 10.96:1 against the base stage color while the invitation card keeps burgundy typography.

### Minor — Oqshom date sat too close to the envelope pocket in the inner hero

- **Observed**: on wide viewports the live date visually collided with the photographic pocket edge.
- **Fix**: moved the live copy block upward while keeping it centered inside the blank paper area.
- **Result**: invitation label, names, and date remain on the ivory card at mobile, tablet, and desktop sizes.

## Visual Hierarchy

- The closed envelope is the unequivocal first object in every theme.
- The wax seal is the only actionable control and has enough visual weight without becoming oversized.
- The card reveal preserves the priority order: invitation label → couple names → date.
- Each long-form page opens with a distinct, full-height editorial hero and follows with greeting, story, date, venue, countdown, and finale.
- Decorative flowers, textile patterns, pearls, and gold linework stay at the edges or behind content rather than competing with names and event information.

## Aesthetic Fidelity

- **Bahor**: warm paper, botanical motion, sage/blush palette, and daylight shadows feel cohesive and materially light.
- **Oqshom**: emerald paper, antique gold, oxblood wax, dark flowers, and photographic night staging form a controlled Art Deco ceremony.
- **Nafis**: ivory stationery on burgundy velvet, pearl points, couture framing, and wine wax create a distinct romantic-luxury direction.
- **Ipak**: jade, cream, woven diagonals, gold geometry, and pomegranate accents communicate crafted textile warmth without copying a legacy template.
- The shared animation reads as one continuous physical action rather than a cross-fade or image morph.

## Responsiveness

- Tested page widths exactly match 375, 768, and 1280 CSS pixels with no horizontal overflow in any template.
- The envelope remains portrait-appropriate and centered instead of stretching across desktop screens.
- Mobile invitation sections stack; tablet and desktop story sections become asymmetric editorial grids.
- All four pages contain seven complete content sections and preserve a clear reading rhythm across breakpoints.
- Long sample names (`Abdulaziz` and `Muhabbatxon`) remain inside the live card and do not create document overflow at 375px.

## Accessibility

- The wax seal is a native button with a localized accessible name.
- Enter activates the opening; the test confirmed the scene enters `is-opening` and the trigger disables against double activation.
- The touch target measures 79×79px at 375px, exceeding the 44×44px minimum.
- After opening, body scroll unlocks, the scene is hidden, and focus moves to the main invitation.
- Decorative envelope geometry is hidden from assistive technology; real invitation headings remain in document order.
- Opening-stage contrast ratios: Bahor 5.51:1, Oqshom 12.59:1, Nafis 10.96:1, Ipak 7.42:1.
- Reduced-motion rules remove continuous ambient motion and collapse the opening into a short handoff.

## Performance and Runtime

- Flap, card, seal, and camera movement animate through transform and opacity; the two principal moving layers explicitly use `will-change: transform`.
- No animation library or new runtime dependency was added.
- The inner Oqshom hero no longer needs a continuous canvas redraw; it uses a static photographic layer with live HTML text.
- The Bahor page video is paused while the envelope is active and resumes only after handoff, avoiding simultaneous hero and envelope playback.
- All four opening sequences complete with the scene hidden, body unlocked, and no browser console warnings or errors.
- HTTP and render matrices pass for four public templates and all seven public/legacy renderable templates in Uzbek and Russian.
- Card preview mode hides the envelope and forces revealed static content for all four catalog cards.

## Final Assessment

The implementation meets the brief's three principles: the opening is a readable ritual, the ornament supports a specific atmosphere, and the motion remains fluid and composited. The four templates are visually distinct while sharing one maintainable envelope engine. No follow-up design blockers remain.
