# Project architecture
- Store member reference photos in the private `member-photos` bucket under `{ownerId}/{memberId}/`; keep only the path on the existing member record so private media is never exposed publicly.
- Keep photo recognition behind `src/lib/photoAttendance.ts` and never fabricate matches; a server-side provider is required for actual recognition and private photo processing.
- Write reviewed attendance to the existing `attendance` table keyed by member and date; its unique constraint prevents duplicate records.
- Validate reference-photo face count on-device before upload, but keep identity matching on a server-side service; this protects private photos and prevents a browser-only identity decision.
- Run enrollment and batch-only recognition in the photo-recognition Edge Function using Amazon Rekognition; store provider face identifiers only in the service-only member_face_enrollments table so raw face vectors and credentials never reach clients.