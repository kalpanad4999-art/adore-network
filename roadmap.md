# Attendance update
- [x] Inspect existing member, batch, attendance, permissions, and storage flows.
- [x] Add private member reference photos to existing member records.
- [x] Replace simulated verification with photo-based review and preserve manual attendance.
- [ ] Validate attendance saving, duplicate handling, and signed-in flow (blocked: requesting account has no visible batches).
- [ ] Connect Amazon Rekognition credentials through a workspace administrator (blocked: this account cannot create a connection; no existing connection is available). Secure enrollment and batch-only matching are implemented but cannot run until connected; the unavailable state now falls back to review without a fatal 503.
- [x] Separate live camera preview/capture/retake from the photo picker for member and batch photos; allow JPG, PNG, WEBP.
- [x] Check member reference photos locally for one sufficiently large face before accepting them.