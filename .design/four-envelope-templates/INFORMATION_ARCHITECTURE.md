# Information Architecture: Four Living Envelope Invitations

## Site Map

- Invitation builder `/app/`
  - Template catalog (existing step inside the single-page builder)
  - Template card preview `/demo/:templateId?card=1`
  - Full template preview `/demo/:templateId`
- Public invitation `/i/:slug`
  - Closed envelope stage
  - Personalized invitation story
- Admin `/admin/`

This feature changes the two preview surfaces and the public invitation render. It does not add a navigation level or a new application route.

## Navigation Model

- **Primary navigation**: none inside an invitation. The experience is a linear ceremonial story, not a website menu.
- **Secondary navigation**: no section index. Scrolling is the only reading progression after the envelope opens.
- **Utility navigation**: the existing floating music control remains available after opening; map links remain inside the venue section.
- **Mobile navigation**: unchanged. The full invitation is one continuous vertical document.
- **Entry action**: the wax seal is the only primary action before the invitation becomes visible.

## Content Hierarchy

### Envelope Stage

1. Closed envelope and seal — establishes the physical invitation ritual immediately.
2. Couple initials — confirms personalization without exposing the full invitation prematurely.
3. Localized opening hint — makes the interaction unambiguous.
4. Ambient flowers, fabric, light, and ornament — creates atmosphere while remaining subordinate to the envelope.

### First Invitation View

1. Couple names — the dominant emotional and visual anchor.
2. Invitation label and wedding date — answers what the page is and when the event occurs.
3. A restrained continuation cue — invites the guest to scroll.

### Invitation Story

1. Personalized guest greeting when available.
2. Emotional invitation message.
3. Couple photography and a short editorial statement.
4. Date and time as a large standalone moment.
5. Venue/address and map actions.
6. Secondary photography or thematic interlude.
7. Countdown.
8. Final message and couple signature.

## User Flows

### Guest Opens a Public Invitation

1. Guest arrives at `/i/:slug`.
2. A closed, personalized envelope fills the initial viewport.
3. Guest presses the seal.
   - Standard motion: seal reacts, flap opens, card rises, camera hands off to the invitation.
   - Reduced motion: the scene responds briefly and dissolves directly into the first invitation view.
4. Music starts only if configured and permitted by the gesture.
5. Guest scrolls through greeting, story, date, venue, map, countdown, and finale.
6. Guest may pause/resume music or open a map provider.

### Customer Compares Templates

1. Customer enters the template step in `/app/`.
2. Four listed cards are returned by `/api/config` in manifest order.
3. Card previews use `/demo/:templateId?card=1` and bypass the envelope so the customer can compare the inner visual language quickly.
4. Customer opens a full demo to experience the complete envelope ritual.
5. Customer selects one template and continues the existing order flow.

### Legacy Invitation

1. Guest opens a previously paid invitation tied to a hidden legacy template.
2. The existing legacy template still resolves by its original ID.
3. No new customer can select that hidden template.

## Template Page Structures

### Bahor

Envelope garden → names/date hero → personalized letter → first photo → vow interlude → date → venue/map → second photo → countdown → floral finale.

### Oqshom

Candlelit envelope → night monogram hero → personalized prologue → editorial photo/story grid → date → venue/map → second photo → countdown → sealed finale.

### Nafis

Velvet envelope → couture title card → personal salutation → framed portrait → love note → date ribbon → venue/map → gallery detail → countdown → wine-wax signature.

### Ipak

Ornamental envelope → woven monogram hero → guest greeting → textile-framed photo → union statement → calendar medallion → venue/map → second photo → countdown → pomegranate finale.

## Naming Conventions

| Concept | Label in UI | Notes |
| --- | --- | --- |
| Light botanical template | Bahor | Existing public ID and display name are preserved. |
| Dark evening template | Oqshom | Existing public ID and display name are preserved. |
| Burgundy couture template | Nafis | Means refined/elegant and does not conflict with hidden Marsala. |
| Jade textile template | Ipak | Means silk and signals material craft without reusing hidden Atlas. |
| Initial interaction | Open invitation | Localized through the existing `L.openHint` string. |
| Couple identifier | Initials | Derived from the live groom and bride values. |
| Main physical insert | Invitation card | The visual bridge from envelope to page. |

## Component Reuse Map

| Component | Used on | Behavior differences |
| --- | --- | --- |
| Shared envelope stage | Bahor, Oqshom, Nafis, Ipak full demos and public pages | Theme comes from CSS variables and a `data-envelope-theme` value. |
| Scroll reveal `.fx` | All four invitations | Variant classes control direction, scale, line draw, or botanical entrance. |
| Map block | All four invitations | Inherits template-local `--gold` and `--paper` variables. |
| Countdown script | All four invitations | Layout and type styling differ; IDs and data contract remain shared. |
| Audio widget | All four invitations | Color treatment inherits template CSS; playback contract is unchanged. |
| Card preview bypass | Builder catalog | Hides the envelope and forces revealed, static content. |

## Content Growth Plan

Template growth is folder-based: each future template adds `templates/<id>/manifest.json` and `template.html`. The shared envelope engine supports new themes through variables and data attributes so new public templates do not require another animation implementation. Hidden legacy templates remain renderable but are excluded from the public configuration.

## URL Strategy

- Pattern: `/demo/:templateId` for full demos, `/demo/:templateId?card=1` for catalog previews, `/i/:slug` for personalized invitations.
- Dynamic segments: `templateId` maps directly to a template folder; `slug` maps to the stored application.
- Query parameters: demos keep existing `groom`, `bride`, `lang`, `address`, `lat`, `lng`, `map`, and `card` parameters.
- New public template IDs: `nafis` and `ipak`.
