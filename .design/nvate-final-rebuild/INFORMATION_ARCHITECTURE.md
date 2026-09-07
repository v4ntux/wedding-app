# Information Architecture: nvate Final Platform

## Site Map

- Product entry `/`
  - Redirects to the Telegram-first Studio `/app/`
- Invitation Studio `/app/`
  - Language gate
  - Names
  - Date and time
  - Venue and optional map
  - Music
  - Template selection
  - Photos
  - Full personalized preview
  - Optional guest links and extras
  - Contact and order summary
  - Success / My invitations
- Template demo `/demo/:templateId`
  - Public sample data
  - Complete closed-envelope experience
  - Static card preview `/demo/:templateId?card=1`
- Published invitation `/:slug`
  - Closed envelope
  - Continuous invitation paper
  - Optional personalized guest route `/:slug/:guestSlug`
- Admin `/admin/`
  - Telegram-authenticated overview of applications
- JSON and upload APIs `/api/*`, `/uploads/*`
  - Configuration, preview, application submission, user orders, admin data, uploads, geocoding, and music helpers

## Navigation Model

- **Primary navigation**: none. The Studio is a guided linear working surface; an invitation is a ceremonial linear document.
- **Secondary navigation**: the Studio progress rail exposes nine destinations and allows returning to completed blocks. Locked future blocks cannot bypass validation.
- **Utility navigation**: language switch, My invitations, preview close, music control, map-provider links, and admin actions.
- **Mobile navigation**: a compact sticky progress dock and top utility bar; no hamburger or separate route layer.
- **Invitation navigation**: scrolling only after the envelope opens. The seal is the sole primary action before content reveal.

## Content Hierarchy

### Studio `/app/`

1. **Current required decision** -- one active block owns visual attention and gives immediate feedback.
2. **Live invitation identity** -- couple names, selected date, and template context keep the work emotionally grounded.
3. **Progress rail** -- communicates completion and makes correction possible without exposing unrelated navigation.
4. **Final personalized preview** -- proves that the order data and final renderer match before contact and submission.
5. **Optional services** -- guest links and domain remain subordinate to the invitation itself.
6. **Price/contact summary** -- appears only when enough information exists to be meaningful.

### Template Catalog Inside Studio

1. **Live static paper preview** -- a motion-free glimpse of each template's actual composition.
2. **Template name and price** -- concise comparison information.
3. **Photo requirement** -- prevents a later surprise.
4. **Full demo action** -- optional complete envelope experience with sample data.

### Full Preview

1. **Closed personalized envelope** -- dynamic initials and template atmosphere.
2. **Opening ritual** -- seal, flap, card rise, handoff.
3. **Actual order content** -- real names, date/time, address/map, uploaded photos, music, language, and options.
4. **End-of-paper completion** -- returns the couple to the remaining Studio steps without losing data.

### Published Invitation

1. Couple names
2. Invitation title and personal salutation when present
3. Invitation message
4. One dominant photograph
5. Emotional paragraph
6. Wedding date and time
7. Venue and map actions
8. Countdown
9. Final message and couple signature
10. `nvate` credit

### Admin

1. Pending application and contact details
2. Price and selected services
3. Payment confirmation / rejection actions
4. Published URL and guest links
5. Recent order history

## User Flows

### Couple Creates an Invitation

1. Couple opens `/app/` from Telegram and chooses Uzbek or Russian.
2. They complete each required block; the Studio validates locally and unlocks the next block.
3. They compare four static card previews and select a template.
4. They upload the required number of photos and optionally choose music.
5. The Studio POSTs the complete form to `/api/preview`.
   - If validation fails, focus returns to the responsible block with a localized error.
   - If validation succeeds, the exact production renderer returns a watermarked full invitation.
6. They open the seal and inspect their actual invitation.
7. They optionally add personalized guest links or a custom domain.
8. They provide at least two contact methods, review the calculated total, and submit.
9. They see a success state and can open My invitations.

### Customer Compares a Template

1. Studio loads `/api/config` and receives only listed templates.
2. Each carousel card lazily loads `/demo/:templateId?card=1`.
3. Card preview bypasses envelope, scroll motion, and audio.
4. A full-demo action opens `/demo/:templateId` with sample data only.
5. Selecting the template updates requirements and invalidates any old personalized preview.

### Guest Opens a Paid Invitation

1. Guest follows `/:slug` or `/:slug/:guestSlug`.
2. Server resolves the exact stored template ID, including hidden legacy templates.
3. The guest activates the seal by pointer, Enter, or Space.
4. Music starts only after this gesture when configured.
5. Focus moves into the continuous invitation paper after the envelope handoff.
6. The guest reads, uses map links, and may pause/resume music.

### Admin Publishes an Invitation

1. Admin receives the new application in Telegram and/or opens `/admin/`.
2. Admin confirms payment.
3. Service generates an idempotent unique couple slug and optional guest slugs.
4. Couple receives the published URLs.
5. Historic applications continue to resolve their original hidden template.

### Legacy Invitation Compatibility

1. Server reads the stored template ID from an existing application.
2. Atlas, Marsala, and Royal resolve from hidden template folders.
3. They never appear in `/api/config` and cannot be selected for new orders.
4. Missing-template fallback is treated as an error signal, not a normal migration path.

## Naming Conventions

| Concept | Label in UI | Notes |
| --- | --- | --- |
| Builder | Studio / Taklifnoma studiyasi | Product name, not a generic form. |
| Template | Dizayn / Дизайн | Clear customer-facing term; internal code keeps `template`. |
| Full preview | Taklifnomani ochish / Открыть приглашение | Promises the actual result, not a sample. |
| Sample | Demo / Namuna | Used only on `/demo/:templateId`. |
| Personalized link | Mehmon havolasi / Именная ссылка | One link per guest. |
| Published invitation | Taklifnoma / Приглашение | Never called a website or landing page. |
| First interaction | Ochish uchun bosing / Нажмите, чтобы открыть | Localized accessible seal label. |

## Component Reuse Map

| Component | Used on | Behavior differences |
| --- | --- | --- |
| Server template renderer | Demo, personalized preview, paid invitation | Demo injects sample data and watermark; preview uses form data and watermark; paid uses database data. |
| Physical envelope engine | Four public templates and compatible modern invitations | Theme variables change material and atmosphere; behavior stays identical. |
| Card-preview bypass | Studio carousel | Hides envelope, locks motion/audio, reveals paper. |
| Preview sheet | Template demo and personalized preview | Demo uses a URL; personalized preview uses server-rendered `srcdoc`. |
| Map block | All modern templates | Hidden when map is disabled; labels localized. |
| Audio widget | All modern templates | Starts after opening gesture; hidden when no music. |
| Countdown | All modern templates | Uses invitation date/time and template-local styling. |
| Legacy renderer | Atlas, Marsala, Royal | Render-only, not selectable. |

## Content Growth Plan

- New public templates remain folder-based but must provide a distinct composition and pass the same viewport/review matrix before `listed:true`.
- New event types may be added only after at least one complete event-specific template exists; inactive event labels remain disabled.
- Application history grows in SQLite and admin listings; the current recent-order limit remains acceptable for this pass.
- Optional paid services remain data-driven in `ADDONS`, but they stay in the summary layer and do not create new primary Studio steps.

## URL Strategy

- **Studio**: `/app/` is the primary product surface; `/` redirects there.
- **Sample**: `/demo/:templateId`; `?card=1` is the only presentation mode flag.
- **Published**: `/:slug`; optional personalized recipient is `/:slug/:guestSlug`.
- **APIs**: `/api/config`, `/api/preview`, `/api/applications`, `/api/my`, `/api/admin/*`, `/api/upload*`, `/api/geo*`, and `/api/music*` remain stable.
- **Template IDs**: stable lowercase IDs; public are `bahor`, `oqshom`, `nafis`, `ipak`; hidden compatibility IDs are never repurposed.
- **Demo parameters**: sample demo may accept names/language/address/map for comparison, but only `/api/preview` is allowed to represent an actual order.
