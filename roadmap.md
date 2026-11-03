# Attendance update
## Interactive logo intro
- [ ] Replace opening presentation with an isolated image-based 3D relief; preserve authentication, routes and data.
- [ ] Verify rendering, drag/wheel interaction, mobile framing, reduced motion and automatic transition.
## Consolidated schema reference
- [x] Audit all 70 available migrations without modifying or executing them.
- [x] Prepare schema.sql and document missing definitions, default drift, and managed-service dependencies.
- [x] Validate SQL syntax, final source definitions, metadata coverage, and unchanged migration checksums.
- [ ] Certify full live-catalog equivalence (blocked: SQL execution prohibited; metadata omits complete constraints, indexes, ACLs, and routine definitions).

## Authentication reliability
- [x] Identify the source of the login connectivity error without changing users, roles, or policies.
- [x] Verify the configured authentication URL and public key belong to the same project.
- [x] Improve email, phone, Google callback, password-reset, and session-restoration error reporting.
- [ ] Verify successful email, phone, Google, and password-reset flows after the hosted backend is resumed.

## Application-wide refactoring request
- [x] Begin read-only review of all feature modules and existing test coverage.
- [x] Consolidate feature, access/settings, infrastructure, and test-baseline findings into the staged plan.
- [ ] Obtain approval for Phase 1 (Members and developer documentation) before application-code changes.
- Implementation starts with Members after approval; Python implementation and backend/data migration are excluded.

- [x] Inspect existing member, batch, attendance, permissions, and storage flows.
- [x] Add private member reference photos to existing member records.
- [x] Replace simulated verification with photo-based review and preserve manual attendance.
- [ ] Validate attendance saving, duplicate handling, and signed-in flow (blocked: requesting account has no visible batches).
- [ ] Verify browser face recognition end to end with a real member photo and batch.
- [x] Separate live camera preview/capture/retake from the photo picker for member and batch photos; allow JPG, PNG, WEBP.
- [x] Check member reference photos locally for one sufficiently large face before accepting them.
- [x] Correct private member-photo upload/read/remove policies to check the storage object's path against the existing member and Owner/assigned Staff permissions; keep face-enrollment records service-only.
- [ ] Verify Owner photo upload → enrollment → signed photo retrieval (blocked: Owner test session cannot be minted by this workspace role; AWS recognition is not connected). The current signed-in Staff account has attendance access but not member-editing access, so it must not upload reference photos.
- [ ] Verify one real member photo → private provider face enrollment → group-camera recognition → reviewed attendance (blocked: AWS recognition credentials are not configured; no saved reference photos or face enrollments exist). Diagnostic steps now report errors in browser/server logs without exposing private images or credentials.
- [ ] Connect recognition and confirm a real member's face enrollment and attendance both save (blocked: October 6 connection attempt denied by workspace role; an administrator must connect AWS, and the user must provide a consented member face photo and identify its existing member record; current uploads contain only a logo and report).