# Design Brief: Four Living Envelope Invitations

## Problem

The invitation currently opens as a decorative full-screen scene, but the product's defining ritual has been lost: the guest should first encounter a closed envelope, choose to open it, and watch the invitation physically emerge from inside. A generic transition, cross-faded image sequence, or static landing page makes the experience feel like an ordinary website rather than a personal invitation.

## Solution

Create four complete wedding invitation templates built around one shared, high-performance envelope ceremony. Every experience begins with a materially believable closed envelope. A press on the seal starts a continuous sequence: the seal responds, the flap rotates open as a rigid paper piece, the inner card rises from the pocket, and the card becomes the first surface of the invitation. The page beyond keeps the existing useful content while giving each template its own flowers, light, ornament, rhythm, and atmosphere.

The four public templates are:

1. **Bahor** — warm ivory paper, blush peonies, sage leaves, morning sunlight, botanical editorial composition.
2. **Oqshom** — deep emerald paper, antique gold linework, candlelit shadows, restrained night florals, Art Deco ceremony.
3. **Nafis** — milk-white envelope on burgundy velvet, wine wax, pearl highlights, romantic couture styling.
4. **Ipak** — jade and cream paper, woven Uzbek-inspired geometric ornament, pomegranate accents, crafted textile warmth.

## Experience Principles

1. **Ritual over transition** — opening the invitation must feel like a deliberate physical act with understandable cause and effect, not a slideshow between unrelated images.
2. **Atmosphere over decoration** — every flower, shadow, ornament, and particle supports the template's emotional world; details never become random visual noise.
3. **Fluidity over spectacle** — use transform and opacity on isolated layers, restrained timing, preloaded assets, and reduced-motion handling so the experience remains smooth on ordinary phones.

## Aesthetic Direction

- **Philosophy**: Tactile Ceremony — editorial wedding design combined with believable paper objects, cinematic light, and a carefully paced reveal.
- **Tone**: intimate, premium, warm, ceremonial, alive.
- **Reference points**: the supplied portrait videos' real envelope ritual and upward card reveal; luxury stationery photography; botanical editorial layouts; Uzbek textile craft for Ipak; 1920s geometric restraint for Oqshom.
- **Anti-references**: image morphing, frame cross-fades presented as physical movement, generic CSS envelope icons, neon/glass dashboard styling, excessive floating particles, cartoon wax seals, copied names baked into reference footage.

## Existing Patterns

- **Typography**: template-local Google Fonts; Cormorant Garamond and Manrope in Bahor, Forum and Manrope in Oqshom. The new templates extend this serif-plus-clean-sans system.
- **Colors**: each template owns CSS custom properties inside its page. Public app tokens remain untouched.
- **Spacing**: long-form mobile-first sections use generous vertical rhythm, full-bleed photography, and larger spacing above 760px.
- **Components**: shared `experienceCSS()` and `experienceScript()` provide the opening ceremony, scroll reveal, music start, and reduced-motion behavior; `mapEmbed`, `audioWidget`, and countdown blocks remain shared.
- **Content model**: groom and bride names, guest name, date/time, language, venue/map, up to the template's minimum photo count, music, and localized strings are injected by the existing template engine.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| Envelope stage | Modify | Replace the living-video intro with a layered physical scene shared by all four templates. |
| Envelope back and inner lining | New | Separate rigid layers with template-specific color, texture, and ornament. |
| Envelope flap | New | Hinged 3D paper plane with front/back materials and dynamic shadow. |
| Envelope front pocket | New | Masks the card while it rises and keeps the geometry readable. |
| Wax seal | New | Press feedback, split/peel moment, initials, keyboard-accessible trigger. |
| Invitation card | New | Dynamic names/date; rises from inside and visually hands off into the page. |
| Ambient botanical/ornamental frame | New | Per-template flowers, leaves, fabric folds, candle glow, or woven corner forms. |
| Scroll reveal system | Modify | Keep `.fx` contract; expand variations for bloom, line draw, lift, and stagger. |
| Bahor long-form page | Modify | Preserve current content depth while integrating the new opening and richer botanical motion. |
| Oqshom long-form page | Modify | Preserve current content depth while integrating the new opening and restrained night motion. |
| Nafis long-form page | New | Burgundy couture story with two photos, date, venue, countdown, and finale. |
| Ipak long-form page | New | Jade textile story with two photos, date, venue, countdown, and finale. |
| Music control | Exists | Starts only after the guest gesture; remains independently toggleable. |
| Map and countdown | Exists | Reuse current generated blocks and localization. |

## Key Interactions

1. **Idle**: the closed envelope is immediately recognizable. Environmental light, leaves, textile highlights, or candle glow move almost imperceptibly. The hint remains readable and the seal gently breathes once, not continuously.
2. **Press**: the seal compresses and emits a fine circular response. The trigger is disabled to prevent double activation.
3. **Release**: the seal separates or peels away; the flap opens with a slight hinge anticipation and a moving contact shadow.
4. **Card reveal**: the card rises from behind the front pocket after the flap clears it. Names and date remain sharp because they are live HTML, never baked into reference video.
5. **Handoff**: the camera eases toward the card while the surrounding stage fades. The first invitation section is already aligned behind it, preventing a visible jump.
6. **Invitation reading**: sections reveal once as they enter the viewport. Decorative elements lead content by a small stagger, then copy and controls settle into place.
7. **Audio**: music may start from the opening gesture and can always be stopped through the existing floating control.

Target duration for the full opening is approximately 2.6 seconds. The sequence must use only composited transforms and opacity during motion; no layout-driven animation or per-frame image morphing.

## Responsive Behavior

- **320–599px**: envelope fills most of the width but preserves stage margins; foreground flowers crop intentionally at the edges; card text is limited to safe lines; long-form layouts stack.
- **600–899px**: stage widens, decorative corners become more visible, photo/story sections may use asymmetric two-column arrangements where space permits.
- **900px and above**: envelope remains portrait-proportioned rather than stretching; background atmosphere expands laterally; invitation sections use editorial grids and controlled full-bleed media.
- Short landscape viewports reduce the envelope scale and trim nonessential ambient elements without skipping the ritual.
- Card preview mode bypasses the envelope and disables all motion as it does today.

## Accessibility Requirements

- Seal trigger is a native button with a localized accessible name and visible keyboard focus.
- Enter and Space start the same sequence as pointer activation.
- The decorative scene is hidden from assistive technology; the destination page retains the real heading and content order.
- Text contrast targets at least 4.5:1 for body copy and 3:1 for large display copy.
- `prefers-reduced-motion: reduce` keeps the closed-envelope decision but completes the opening with a short opacity handoff instead of 3D travel.
- Focus moves naturally into the invitation after the stage is hidden; no focus is trapped behind the overlay.
- Touch targets are at least 44×44 CSS pixels.

## Performance Constraints

- No runtime dependency or animation library is added.
- The opening uses a small fixed DOM tree and GPU-friendly properties only.
- Decorative SVG is inline or CSS-generated; raster/video assets are reused only where they materially improve atmosphere.
- Avoid large canvases, continuous full-screen redraw loops, filters on animated full-screen media, and layout reads inside animation frames.
- Test the experience at 375×812, 768×1024, and 1280×800.

## Out of Scope

- Redesigning the order-builder application, admin panel, pricing, payment flow, database schema, or Telegram bot.
- Changing hidden legacy templates or the appearance of already paid legacy invitations.
- Adding RSVP collection, guest messaging, new map providers, or new music integrations.
- Reusing the supplied videos as final personalized invitation footage when they contain baked foreign names or text.
