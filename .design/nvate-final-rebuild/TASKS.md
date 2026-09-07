# Build Tasks: nvate Final Platform Rebuild

Generated from: `.design/nvate-final-rebuild/DESIGN_BRIEF.md`  
Date: 2026-09-04

## Foundation and Safety

- [x] **Recover and pin the ideal snapshot**: Protect Git tree `5c411872ccf1249a595a53a82ffe463c273e1f78` on `codex/rescue-ideal-demo` without resetting the current worktree. _Reuses: recovered August 30 design, code, and screenshot objects._
- [x] **Create a consistent data safety point**: Use SQLite's backup mechanism to save the live database including WAL state before migrations or cleanup, verify the backup opens, and leave uploads untouched. _Modifies: operational artifacts only; protects 45 applications and 76 uploads._
- [ ] **Restore legacy invitation compatibility**: Restore Atlas, Marsala, and Royal exactly as hidden `listed:false` templates and verify the existing paid Atlas record renders Atlas rather than falling back to another template. _Restores: three legacy template components; modifies no customer data._

## Core Product Recovery

- [ ] **Restore the shared Tactile Ceremony envelope**: Replace the video/canvas opening hack with the recovered layered back/lining/card/flap/pocket/seal component, dynamic initials, physical 2.86-second sequence, reduced motion, keyboard operation, and focus handoff. _Restores/modifies: `src/experience.js`; reuses `bahor-botanical-loop.mp4` as ambient atmosphere only._
- [ ] **Restore the four bespoke public invitations**: Recover the reviewed Bahor, Oqshom, Nafis, and Ipak compositions while preserving current manifest prices and the current server data contract. Each page must remain structurally distinct and follow the continuous-paper content order. _Restores/modifies: four `template.html` components; depends on the shared envelope._
- [ ] **Curate the template catalog**: Expose exactly Bahor, Oqshom, Nafis, and Ipak; remove zero-reference Asos/Marjon experiments from runtime; keep Atlas/Marsala/Royal render-only. _Modifies: template folders/manifests and documentation._
- [ ] **Reconnect Studio to the production renderer**: Make the final Studio action use `/api/preview` + `srcdoc`, invalidate cached HTML whenever invitation inputs change, and auto-open the modern `[data-envelope-trigger]`. Actual preview must contain the selected names, date, time, address/map, uploaded photos, music, language, and options. _Modifies: existing Studio preview sheet and server preview object._
- [ ] **Simplify optional commercial features**: Hide the unimplemented custom-domain add-on so the Studio cannot charge for unavailable provisioning; keep personalized guest links optional in the summary layer. _Modifies: existing add-on catalog/UI without changing paid records._

## Security and Correctness

- [ ] **Make Admin rendering XSS-safe**: Replace untrusted `innerHTML` composition with DOM/text construction or strict escaping for names, music, contacts, and guest links; add a hostile-string regression test. _Modifies: existing Admin table/card component._
- [ ] **Protect payment proofs**: Stop serving proof files through the public uploads route, provide an authenticated admin-only proof endpoint, and verify anonymous access fails. _Modifies: upload routing and Admin proof links._
- [ ] **Harden validation and repeat submissions**: Reject impossible/past wedding dates, add a bounded idempotency key for application creation, keep server-owned price calculation, and verify repeat submission cannot create duplicates. _Modifies: service/database/API contract._
- [ ] **Add baseline HTTP protections**: Apply security headers, body/upload limits, and small in-memory rate limits to costly geo/music/upload/application endpoints without breaking Telegram Web App requests. _Modifies: Express middleware._
- [ ] **Correct bot/admin contract drift**: Render iTunes/upload/YouTube music correctly, align FAQ prices with configuration, and keep callback payloads under Telegram limits with ownership checks where applicable. _Modifies: bot formatting/actions._

## Automated Verification

- [ ] **Create a built-in Node test suite**: Add `node --test` coverage for slug generation, strict date/form validation, template parsing, four-public/seven-renderable catalog rules, personalization, legacy rendering, pricing, and hostile Admin strings. _Creates: test modules and `npm test`; no new dependency._
- [ ] **Add HTTP smoke coverage**: Start an isolated server on an ephemeral port and verify `/api/config`, all public demo/card routes in RU/UZ, unknown routes, authenticated preview behavior, anonymous proof denial, and zero unresolved template tokens. _Creates: integration tests; reuses Express server factory._
- [ ] **Run a first regression gate**: Execute syntax checks, `npm test`, dependency audit, runtime endpoint matrix, and inspect server/browser logs. Fix failures before visual polish. _Verification checkpoint after core/security code._

## Responsive and Interaction Polish

- [ ] **Polish Studio as a deliberate atelier**: Preserve the language gate and Golden Thread, remove duplicate late CSS overrides/dead preview code, keep optional services subordinate, and improve wide-screen composition without weakening the Telegram-first mobile flow. _Modifies: Studio HTML/CSS/JS; reuses final tokens._
- [ ] **Run responsive invitation pass**: Validate envelope, opening, and paper at 375x812, 768x1024, 1280x800, 320px width, and short landscape; fix overflow, clipped seal/copy, long names, map sizing, and asset fallback. _Modifies: shared envelope and template-local CSS only where proven necessary._
- [ ] **Run accessibility and motion pass**: Verify Enter/Space, focus handoff, 44px targets, visible focus, RU/UZ labels, contrast, 200% text zoom, reduced motion, double-click prevention, and audio only after gesture. _Modifies: shared interactions as needed._
- [ ] **Run the second regression gate**: Repeat automated tests after every visual fix and compare screenshots with the August 30 reference set so restored behavior is not lost during polish. _Verification checkpoint before final review._

## Cleanup and Documentation

- [ ] **Remove proven dead runtime artifacts**: Delete the video/canvas patch assets, `src/theme.js`, Asos/Marjon runtime folders, and other files only after `rg`, tests, and browser routes prove no references remain. Keep `.design` references and customer uploads. _Removes: only zero-reference artifacts; never touches data records._
- [ ] **Document the actual finished product**: Update README, environment example, template catalog, prices, preview behavior, backup notes, security boundaries, and exact start/test commands. _Modifies: project documentation._
- [ ] **Run final production-like gate**: Fresh install, full tests, server start without bot in local QA mode, API/render matrix, and final Git diff review for accidental or unrelated changes. _Verification checkpoint after cleanup._

## Review

- [ ] **Design review**: Run `design-review` against the new brief, save desktop/tablet/mobile evidence in `.design/nvate-final-rebuild/screenshots/`, and fix every blocker/major issue.
- [ ] **Final end-to-end acceptance**: Complete one Studio order preview, verify exact preview data, open each of four templates, verify paid Atlas compatibility, confirm Admin XSS/proof protections, and leave the working final Studio open for the user. _Final acceptance gate._
