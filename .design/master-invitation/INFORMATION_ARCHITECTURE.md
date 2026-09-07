# Information Architecture: Living Ivory Master Invitation

## Site Map

- Studio `/app/`
  - Existing linear order flow
  - One public master design at the design step
  - Personalized full preview through `/api/preview`
- Master demo `/demo/ivory`
  - Closed envelope
  - Open continuous paper
  - Static card preview `/demo/ivory?card=1`
- Published invitation `/:slug`
  - Master renderer for new applications
  - Stored hidden renderer for existing applications
- Admin `/admin/`
  - Existing application and payment workflow

## Navigation Model

- **Primary navigation**: none inside the invitation.
- **Secondary navigation**: Studio progress rail only.
- **Utility navigation**: Studio language, preview close, music control, map links, and My invitations.
- **Mobile navigation**: unchanged compact Studio dock; invitation itself is scroll-only after opening.

## Content Hierarchy

### Master Invitation

1. Physical envelope and seal -- establishes the object and asks for one deliberate gesture.
2. Names, monogram, and date -- immediate invitation identity.
3. Invitation message -- quiet pause and personal salutation when present.
4. One dominant portrait and emotional paragraph -- human center of the document.
5. Date/time monument -- the primary practical fact.
6. Venue, map, and provider links -- the second practical fact.
7. Countdown -- useful anticipation, visually legible rather than gadget-like.
8. Final message, signature, and nvate credit -- emotional closure.

### Studio Design Step

1. Live paper preview of Living Ivory.
2. Name, price, and one-photo requirement.
3. Full demo action.
4. Selected state; when only one public design exists it is selected for a fresh draft.

## User Flows

### New Invitation

1. Couple completes names, date, venue, and music in Studio.
2. Studio loads the one public master design and selects it for a fresh draft.
3. Couple supplies the required photo.
4. `/api/preview` renders the exact production master with their data.
5. The seal auto-opens inside the preview sheet; the couple reviews the full paper.
6. Submission stores the `ivory` template ID and follows the existing payment flow.

### Guest Opens Master Invitation

1. Guest opens the published slug.
2. Entire envelope is visible in a botanical stage.
3. Guest activates the seal.
4. Seal releases, flap opens, and the independently positioned card rises behind the stationary pocket.
5. Stage hands off focus to the paper; music may start after the gesture.
6. Guest scrolls through the fixed content hierarchy to the finale.

### Existing Invitation

1. Server reads the stored template ID.
2. Hidden Bahor/Oqshom/Nafis/Ipak/Atlas/Marsala/Royal renderers remain available.
3. Missing IDs fail explicitly; no first-template substitution is allowed.

## Naming Conventions

| Concept | Label in UI | Notes |
| --- | --- | --- |
| Public design | Living Ivory | One master design for new orders. |
| First action | Open invitation / Taklifnomani ochish | Native seal button label remains localized. |
| Preview | Full invitation | Always the actual `/api/preview` renderer for the entered data. |
| Hidden designs | Legacy renderers | Internal term; never shown in the new catalog. |

## Component Reuse Map

| Component | Used on | Behavior differences |
| --- | --- | --- |
| Master renderer | Demo, Studio preview, new published invitations | Demo/preview add watermark; published is clean. |
| Envelope engine | Master plus existing modern legacy pages | Master uses fixed-body motion; legacy theme variables remain supported. |
| Card-preview bypass | Studio design shelf | Hides envelope, motion, and audio. |
| Legacy renderer | Existing slugs only | Hidden from `/api/config` and new orders. |

## Content Growth Plan

The master renderer is versioned through code history and can later gain theme tokens without multiplying page skeletons. Existing applications retain their stored template IDs. New public variants, if ever added, should be token themes on the master structure and must pass the same motion and viewport matrix.

## URL Strategy

- Studio stays `/app/`.
- The one public demo is `/demo/ivory`; `?card=1` remains the static shelf mode.
- Published URLs remain `/:slug` and `/:slug/:guestSlug`.
- Hidden template IDs remain stable only for existing data and direct compatibility rendering.
