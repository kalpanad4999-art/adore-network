# TRINETRA YOGA — staged codebase refactoring

## Goal and boundaries
Make the existing code easier for new developers to understand and extend, and isolate backend access for a later Python migration.

This is a behaviour-preserving refactor, not a redesign or backend migration. Keep the React screens, navigation, routes, fields, registration flow, payment calculations, renewal rules, attendance review, browser face recognition, private photos, authentication, and Owner/Staff permissions unchanged. Keep Lovable Cloud connected as the only current data source. No new database, data movement, duplicate writes, Python server, framework upgrades, or unnecessary dependencies.

**Approval applies to Phase 1 only.** Report its outcome before requesting approval for the next phase. No application code changes before approval.

## Review findings
- Large page files mix presentation, state, business rules, queries, storage, subscriptions, and error handling. Members, Payments, Offers, Attendance, and Media are the highest-value separation points.
- Member, batch, payment, and custom-field types are duplicated. Date/duration calculations, receipt building, and member-deletion orchestration also appear in multiple places.
- Useful reusable seams already exist: shared UI, the member details table, receipt/report dialogs, camera dialog, date helpers, offer rules, and route guards. Reuse these rather than replace them.
- Authentication and workspace access have multiple linked responsibilities: login/session management, invitation acceptance, Owner/Staff permissions, app/payment locks, realtime permission updates, and public registration. Preserve their ordering and public callback routes.
- Backend dependencies extend beyond table CRUD: private/public storage, signed URLs, realtime, SQL functions for public registration/invitations/ownership transfer, and four existing backend functions. A future API must account for all of these.
- Developer documentation is incomplete. Architecture instructions still contain conflicting server-side and browser-based recognition rules, and the roadmap includes obsolete AWS blockers.

### Verified baseline and limits
The previous review recorded an automatic build success, 41 passing tests, a photo-test suite that could not load because the package import selected a Node TensorFlow dependency, and 176 lint errors / 32 warnings. Recheck these baselines at Phase 1 start; do not treat them as fresh end-to-end verification.

The review inspected all major feature areas, but did not certify every historical SQL policy, hosted function setting, or live workflow. No real-photo recognition or signed-in business workflow was verified. Historical migrations alone do not establish current deployed permissions.

## Technical structure
Introduce feature folders incrementally, only when logic is actually moved:

```text
src/
  features/
    members/
      components/
      hooks/
      services/
      rules/
      types.ts
    batches/
    payments/
    renewals/
    offers/
    attendance/
    gallery/
    classes/
    insights/
    settings/
    auth/
    staff/
  pages/                 # existing route entry points
  components/ui/         # existing shared design system
  contexts/              # existing global providers initially preserved
  lib/                   # genuinely shared utilities
docs/
  ARCHITECTURE.md
  DEVELOPMENT.md
  BACKEND-CONTRACTS.md
```

Not every feature needs every subfolder. Keep tests alongside extracted code. Share a type only when multiple features genuinely use the same contract; otherwise keep it feature-owned. Do not create a catch-all domain model or universal repository abstraction.

- **Components:** rendering and interaction callbacks.
- **Hooks:** screen state, loading, orchestration, and subscription cleanup.
- **Services:** named operations for reads/writes, storage, signed URLs, SQL functions, and backend-function calls. Use the current generated client internally; do not expose query builders to screens.
- **Rules:** pure, independently tested calculations and validation that preserve existing behaviour.
- **Types:** explicit inputs/results, separating feature contracts from backend-specific response details where useful.

Never manually edit generated clients, generated database types, preview auth storage, environment files, or managed configuration. If schema types are stale, use supported regeneration only when necessary and explicitly report it; otherwise isolate narrow compatibility types at the service boundary.

## Phase 1 — Members first
1. Reconfirm baseline tests/lint and capture the existing Members behaviour and backend-operation sequence.
2. Introduce member-owned types and a small member service covering list/load/create/update/delete, photo upload/download/link/replace/cleanup, and realtime subscription lifecycle. Add batch lookup support without refactoring the entire Batches feature yet.
3. Extract member state/orchestration into a hook and move focused form/table pieces only where that improves readability. Preserve the existing registration screen, field validation, assigned-staff handling, and public Join path; do not merge public registration with authenticated creation.
4. Preserve the exact photo-save order, existing member ID, face enrollment, rollback, old-photo removal, private path convention, and signed-photo display. Keep browser recognition behind its existing integration point; do not replace its algorithm.
5. Add regression tests for service operations and photo-save orchestration: successful save, upload/link/enrollment failures, rollback, replacement, and delete ordering. Mock the recognition dependency at orchestration boundaries; do not invent identity matches or install server-side TensorFlow to make browser tests run.
6. Update README/setup guidance and developer docs: module responsibilities, member data flow, current backend dependencies, how to add a feature, how to run checks, and permission/testing requirements. Reconcile AGENTS.md and remove obsolete AWS roadmap blockers without claiming outstanding checks passed.

### Phase 1 verification
- Run affected tests and existing guard/recognition tests with browser-model code isolated appropriately from pure tests.
- Compare the Members screen before/after, including loading/error states.
- With an authorised test account and consented reference photo, exercise create/edit, save photo, refresh/readback, replace photo, and cleanup using isolated test records.
- Verify assigned Staff access and denied access for an unauthorised user where test accounts permit.
- If an account, photo, or permission is unavailable, report that exact blocker; mock tests do not count as live verification.
- Check current automatic build results. Document existing lint issues separately; do not perform an application-wide lint rewrite.

## Later phases — separately approved
**Phase 2: Batches, Payments, Offers, Renewals.** Extract existing duration/renewal/discount rules and receipt builders with boundary tests, then services/hooks. Preserve payment ordering, redemption writes, reminder behaviour, device-local preferences, and deletion semantics. Non-atomic offer counters and unusual reminder/date behaviour are review items, not permission to change business logic.

**Phase 3: Attendance, Gallery, Classes/Recordings, Insights.** Isolate manual/offline/reviewed attendance, descriptor access, private/public media operations, signed URLs, lifecycle calls, and report data preparation. Preserve duplicate prevention and review-before-submit. Preserve the configured face distance threshold; displayed similarity is not a calibrated probability.

**Phase 4: Settings, Staff, Authentication, shared infrastructure.** Extract operations cautiously around invitations, ownership transfer, security locks, appearance, chatbot knowledge, and public pages. Keep existing contexts/guards until equivalent behaviour is covered. Preserve OAuth callback handling and hosting rewrites.

## Risks kept separate from the refactor
- Photo rollback or replacement reordering can lose photos or leave orphaned files.
- Payment read/write ordering and repeated submission can affect balances or offer usage.
- Realtime and offline/local settings can change behaviour if consolidated indiscriminately.
- Client permission gates are not security enforcement. Check deployed policies before claiming Owner/Staff parity; possible media/lifecycle permission gaps from historical code require a separate confirmed finding and approval for behaviour changes.
- Browser descriptors must remain private under workspace permissions; authorised descriptor access is required by the chosen local-recognition design, not a reason to restore AWS/server matching.
- Hosted function authentication cannot be inferred solely from managed configuration files.

## How this prepares a later Python backend
Screens will depend on named feature operations instead of the current backend SDK. Backend-specific table queries, storage and SQL-function calls will be documented and isolated, so a later Django/FastAPI implementation can replace services without redesigning screens.

The contract documentation will inventory operation inputs/results, validation, workspace permissions, errors, private/public access, subscriptions, and multi-step write ordering. Authentication, storage, realtime, and SQL business rules need explicit migration decisions later; this refactor does not promise that replacing CRUD alone migrates the backend. No hosting purchase is needed now.

## Report after every phase
- Files changed and responsibilities moved.
- Tests run and their actual results.
- Live workflows exercised and results read back.
- Existing issues, unverified checks, and blockers.
- Proposed next phase for approval.