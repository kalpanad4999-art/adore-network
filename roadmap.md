# Attendance update
## Application-wide refactoring request
- [x] Begin read-only review of all feature modules and existing test coverage.
- [ ] Present staged refactoring plan and obtain approval before application-code changes (waiting for user approval).
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