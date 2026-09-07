# Design Brief: Living Ivory Master Invitation

## Problem

The invitation currently loses the illusion of a real object: the letter and envelope shift as one unit, the opening reads as a web transition rather than a physical ritual, and the long page has style but not the density, material detail, and memorable section rhythm shown in the supplied video references.

## Solution

Create one public, versionable master invitation for all new orders. It opens as a layered physical envelope whose stationary body masks an independently moving card, then hands off to a continuous warm-ivory paper experience. Existing customer designs remain hidden and renderable only for compatibility.

## Experience Principles

1. **Physical causality over spectacle** -- every movement has a cause: press the seal, release the flap, expose the pocket, lift the card, reveal the page.
2. **Richness through systems over noise** -- linen, watercolor, botanical depth, hairlines, type rhythm, and contact shadows form a repeatable detail language; no random decoration.
3. **Ceremony over interface** -- the invitation is a tactile document with one opening action and a quiet reading flow, not a dashboard or a stack of generic cards.

## Aesthetic Direction

- **Philosophy**: Editorial botanical minimalism with tactile ceremony.
- **Tone**: intimate, heirloom, warm, composed, quietly luxurious.
- **Reference points**: the physical plane logic in `2.mp4`; the immersive-to-quiet section rhythm in `3.mp4`; the ivory linen, negative space, and three-depth botany in `4.mp4`.
- **Anti-references**: cropped macro video, baked foreign names/initials, glassmorphism, purple gradients, rounded SaaS cards, hot-pink CTAs, busy galleries, love-story timelines, program/gifts blocks, or decorative motion without causality.

## Existing Patterns

- Typography: current invitation pages use Cormorant Garamond plus Manrope; the master retains exactly two families, using italic display cuts instead of a third script face.
- Colors: current templates already establish warm paper, botanical green, muted gold, and wax red. The master narrows them to one semantic token set.
- Spacing: mobile-first vertical sections with generous breathing room; the new page uses an 8px editorial scale.
- Components: reuse the server renderer, localization, music widget, map block, countdown engine, Studio preview sheet, and hidden legacy template resolver. Replace only the public envelope/page presentation.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| Envelope stage | Modify | Separate back, lining, flap, pocket, seal, card, and shadow planes; envelope body must remain fixed. |
| Living botanical field | New | CSS/SVG depth layers; entrance settles into near-still drift, no full-page loop video. |
| Master paper shell | New | One continuous ivory column, 760-840px on desktop, full-width on mobile. |
| Hero | New | Names, date, live monogram, botanical negative space. |
| Invitation copy | New | Quiet typographic pause after the hero. |
| Story portrait | New | One dominant 4:5 photo with a paper mat and short emotional paragraph. |
| Date monument | New | Large day, month/year, weekday, and time with tabular numerals. |
| Venue | Modify | Reuse map output inside a flat paper inset plus Google/Yandex text links. |
| Countdown | Modify | Four borderless columns with hairlines and rolling changed digits only. |
| Finale | New | Live wax/monogram echo, final phrase, signature, and nvate credit. |
| Studio template shelf | Modify | Show one master design and auto-select it for new drafts while preserving the full preview flow. |
| Legacy renderers | Reuse | Hidden, immutable compatibility for existing application template IDs. |

## Key Interactions

- Seal press compresses for 140ms; double activation is ignored.
- Flap anticipates by a few degrees, then rotates behind the envelope in 760-820ms with a moving contact shadow.
- The card starts after the flap clears. It moves in its own coordinate system while the front pocket masks its lower edge; the envelope body does not translate or scale.
- At full lift, the stage fades into the paper page and focus moves to `main`.
- Scroll reveals use one dominant moving layer per section; botanicals settle after entrance.
- Countdown rolls only digits that change. Audio appears after the opening gesture and remains independently controllable.

## Responsive Behavior

- **320-599px**: full envelope visible with at least 20px side air; paper fills viewport; names stay within two lines; touch targets are at least 44px.
- **600-899px**: paper max-width 720px; story can use an asymmetric 5/7 composition.
- **900px+**: central 800-840px paper floats inside a wine/ivory ambient field; hero, portrait, and date gain editorial asymmetry without widening body copy past 40ch.
- **Short landscape**: botanicals simplify and the envelope scales to height; seal, card, and hint never crop.
- **Reduced motion**: keep the explicit open action but replace the physical sequence with a 400ms opacity/scale handoff; disable drift, parallax, and digit rolls.

## Accessibility Requirements

- Native seal button with pointer, Enter, and Space activation; visible focus ring.
- Focus moves to the invitation after handoff.
- Body copy at least 16px, 1.65 line height, and 4.5:1 contrast.
- Decorative SVGs and botanical layers are hidden from assistive technology.
- Audio never begins before a user gesture.
- The page remains readable at 200% zoom and at 320px width with no horizontal overflow.

## Performance Requirements

- No canvas, animation framework, or full-screen background video for the master invitation.
- Opening animation uses transform and opacity on a bounded layer tree.
- Card previews do not create envelope media or autoplay work.
- Stop ambient motion when the document is hidden; keep initial master transfer below the previous video-based design.

## Out of Scope

- Love story timeline, day program, gifts, RSVP, dress code, galleries, navigation, accounts, or online payments.
- Deleting customer records or removing renderer files required by existing invitations.
- Rebuilding the Node/Express/Telegram platform in another framework.
- Deploying to an unspecified production target.
