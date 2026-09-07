# Build Tasks: Four Living Envelope Invitations

Generated from: `.design/four-envelope-templates/DESIGN_BRIEF.md`  
Date: 2026-08-30

## Foundation

- [x] **Build the shared tactile envelope ceremony**: Replace the active living-video opening with a layered closed envelope, hinged flap, front pocket, live invitation card, wax seal, ambient frame, and a 2.6-second GPU-friendly opening sequence. The result must look physically continuous at 375×812 before template-specific page work begins. _Modifies: `experienceCSS()` and `experienceScript()`; philosophy: Tactile Ceremony._
- [x] **Define the four envelope material themes**: Add variable-driven Bahor, Oqshom, Nafis, and Ipak surfaces, ornaments, light, florals, focus states, and responsive crops without duplicating the engine. _Reuses: `.design/four-envelope-templates/tokens.css`; extends the shared envelope component._

## Core UI

- [x] **Integrate and enrich Bahor**: Restore a closed ivory botanical envelope, keep the complete current invitation content, and add coordinated bloom, leaf-shadow, line, and editorial section reveals. _Modifies: existing `templates/bahor`; depends on the shared envelope ceremony._
- [x] **Integrate and enrich Oqshom**: Restore a closed emerald-and-gold envelope, keep the complete current invitation content, and add candle glow, gold-line, dark floral, and controlled Art Deco reveals. _Modifies: existing `templates/oqshom`; depends on the shared envelope ceremony._
- [x] **Create Nafis**: Add a listed burgundy couture invitation with milk paper, velvet atmosphere, wine wax, pearl floral details, two-photo story, date, venue/map, countdown, and finale. _Creates: `templates/nafis`; reuses shared map, audio, countdown, and envelope components._
- [x] **Create Ipak**: Add a listed jade textile invitation with woven geometric ornament, pomegranate details, two-photo story, date, venue/map, countdown, and finale. _Creates: `templates/ipak`; reuses shared map, audio, countdown, and envelope components._

## Interactions & States

- [x] **Complete envelope state handling**: Cover loading, ready, press, opening, finishing, double-press prevention, keyboard activation, focus, reduced motion, music start, and graceful reveal if animation setup fails. _Modifies: shared experience script._
- [x] **Coordinate invitation scroll motion**: Extend `.fx` with thematic variants while preserving one-time IntersectionObserver reveals and static card-preview behavior. Covers: hidden, entering, revealed, reduced-motion, preview. _Modifies: shared experience CSS and four templates._
- [x] **Protect legacy and catalog behavior**: Keep Atlas, Marsala, and Royal hidden but renderable; list exactly Bahor, Oqshom, Nafis, and Ipak in manifest order; verify new order validation accepts only listed IDs. _Reuses: existing template store and service filtering._

## Responsive & Polish

- [x] **Responsive composition pass**: Tune envelope scale, flower crops, text fit, section grids, map width, and full-bleed photography at 375×812, 768×1024, and 1280×800, including short landscape viewports. _Breakpoints: 375, 600/760, 900/1024, 1280._
- [x] **Accessibility and performance pass**: Verify native button semantics, localized label, keyboard opening, ≥44px target, visible focus, content order, contrast, `prefers-reduced-motion`, asset errors, no full-screen animation loops, and no layout-driven animation. _Modifies: shared envelope and templates as needed._
- [x] **Card-preview compatibility**: Ensure `/demo/:templateId?card=1` bypasses the opening, shows revealed content, disables motion, and remains suitable for the builder carousel for all four public templates. _Modifies: render preview override if needed._

## Review

- [x] **Automated and runtime verification**: Start the project, query `/api/config`, render all four demos and card previews, inspect logs, and verify no template parse/runtime errors.
- [x] **Design review**: Run `/design-review` against the brief with screenshots at all required viewports, record issues in `DESIGN_REVIEW.md`, fix issues, and re-review until no blockers remain.
