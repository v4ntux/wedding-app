# Build Tasks: Living Ivory Master Invitation

Generated from: `.design/master-invitation/DESIGN_BRIEF.md`  
Date: 2026-09-04

## Foundation

- [x] **Reference motion audit**: Inspect `2.mp4`, `3.mp4`, and `4.mp4` frame by frame and extract physical, structural, and botanical rules. _Reuses: user-supplied videos; creates no runtime component._
- [x] **Compatibility boundary**: Keep current customer template IDs renderable while defining one public master ID for new orders. _Reuses: template store and existing legacy files._
- [x] **Master tokens and content skeleton**: Define the Living Ivory palette, type system, spacing, motion, responsive contract, and strict section order. _Creates: design artifacts; reuses existing renderer data contract._

## Core UI

- [ ] **Fixed-body envelope ceremony**: Build the stationary back/lining/pocket with independent flap, seal, card, contact shadows, masking, keyboard operation, and focus handoff. _Modifies: shared envelope component; establishes the editorial botanical direction._
- [ ] **Continuous Living Ivory paper**: Build hero, invitation copy, portrait/note, date monument, venue/map, countdown, and finale as one responsive paper document. _Creates: one public master template; reuses map, countdown, music, localization._
- [ ] **One-design Studio shelf**: Expose only Living Ivory for new orders, auto-select it for fresh drafts, and keep the production-renderer preview flow. _Modifies: manifests and Studio selection state._

## Interactions & States

- [ ] **Motion and visibility lifecycle**: Stop background work when hidden, omit envelope work in card mode, prevent double-open, and keep reduced-motion behavior explicit. _Modifies: shared experience script._
- [ ] **Countdown and audio polish**: Verify digit rolls, static zero state, 48px music control, and post-gesture playback. _Modifies/reuses: shared blocks and template styles._
- [ ] **Failure-safe rendering**: Remove first-template fallback and make unknown legacy IDs fail visibly without showing the wrong design. _Modifies: server renderer and tests._

## Responsive & Polish

- [ ] **Viewport pass**: Validate 320px, 375x812, 768x1024, 1280x800, and short landscape in closed, opening, and paper states. _Modifies: envelope/master CSS only where evidence requires._
- [ ] **Accessibility pass**: Verify focus, Enter/Space, target sizes, contrast, RU/UZ labels, 200% text zoom, reduced motion, and no autoplay audio. _Modifies: shared experience as needed._
- [ ] **Performance and dead-asset cleanup**: Remove video/canvas patch assets no longer referenced by runtime and verify card previews make no envelope media requests. _Removes: proven zero-reference assets only._
- [ ] **Regression gate**: Update automated catalog/render/legacy tests, run syntax, tests, endpoint matrix, and dependency audit. _Modifies: built-in Node test suite._

## Review

- [ ] **Design review**: Run `design-review` against this brief with saved mobile/tablet/desktop screenshots and fix every blocker or major finding.
- [ ] **Final acceptance**: Open the master from Studio, verify personalized values, check one paid legacy invitation, and leave the working Studio preview open.
