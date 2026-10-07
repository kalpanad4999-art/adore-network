# Project architecture
- Store member reference photos in the private `member-photos` bucket under `{ownerId}/{memberId}/`; keep only the path on the existing member record so private media is never exposed publicly.
- Keep photo recognition behind `src/lib/photoAttendance.ts` and never fabricate matches; a server-side provider is required for actual recognition and private photo processing.
- Write reviewed attendance to the existing `attendance` table keyed by member and date; its unique constraint prevents duplicate records.
- Validate reference-photo face count on-device before upload, but keep identity matching on a server-side service; this protects private photos and prevents a browser-only identity decision.
- Run face recognition in the browser with face-api (models in /models); store only 128-number descriptors in member_face_enrollments under workspace RLS so photos never go to a third-party service.