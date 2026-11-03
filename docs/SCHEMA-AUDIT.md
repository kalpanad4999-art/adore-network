# TRINETRA YOGA — consolidated schema audit

**Date:** 3 November 2026. **Status:** review-only reference, not a production migration or certified restore script.

## Result

The checkout contains **70 SQL migrations, not 73**. All 70 were parsed in filename order without changing them. `schema.sql` resolves their final definitions rather than concatenating historical changes. Missing three files cannot be identified without the original migration inventory.

Included: **28 table definitions** (27 from migrations plus a partial metadata-backed `settings` table), **2 enums, 26 functions, 20 app-owned triggers** (including two auth lifecycle hooks), **36 explicit indexes, 21 migration-defined foreign keys, 97 RLS policies** (76 application / 21 storage), recorded grants/revocations, five FORCE RLS settings, nine FULL replica identities and 12 realtime publication memberships. Primary/unique/check constraints remain in table definitions; their implicit indexes are not duplicated. Existing redundant uniqueness rules are preserved.

No migrations were deleted, edited or reordered. No SQL was submitted to or executed against any database; no migration, bucket, table or live configuration was created. Historical data backfills, account/ownership changes, deletes and bucket-row inserts were excluded. Data-modifying statements **inside retained function bodies** remain because they implement application behavior. No credentials or account-specific historical seeds are included.

## Verification actually performed

- PostgreSQL grammar parser accepted all 70 migrations and the consolidated SQL; this is syntax validation, not execution or dependency validation.
- All 28 table names and column sets match the available backend schema metadata; nullability and presence/absence of defaults match. Metadata collapses numeric precision, array element types and enum types; those finer details use migration definitions.
- All 76 application policy names match metadata. All 97 final policy definitions, 26 final function definitions and 20 final trigger definitions match the latest corresponding source definitions exactly after SQL formatting.
- SHA-256 comparison confirmed every original migration remained byte-for-byte unchanged.
- Application call-site audit covered database/RPC, private storage, auth, attendance, payments, invitations, ownership transfer and realtime dependencies.

**Not a full live-schema certification:** the schema tool returned metadata labelled Connected, but does not establish freshness or full live-catalog equivalence. No direct catalog SQL was run because the request prohibits SQL execution. Live constraint/index definitions, ACLs/default privileges, function bodies/owners, auth/storage triggers and publication/extension settings still need independent confirmation. Metadata policy expressions were not exhaustively compared for semantic equivalence. No clean-database restore or application-flow testing was performed.

## Missing or conflicting details

| Finding | Treatment in schema.sql / limitation |
|---|---|
| `public.settings` has no CREATE TABLE in the 70 files | Includes only its five metadata-reported columns, default and RLS. Primary key, foreign key, delete action, indexes, ownership and grants are unknown; **not a complete table reconstruction**. Generated types omit its relationships, while supplied context suggests an auth-user relationship; neither identifies complete DDL. |
| Four staff-permission defaults disagree | Migration `20260705121907` creates `can_customers`, `can_gallery`, `can_classes`, `can_renewals` default **true**; schema metadata reports **false**. Reference uses **false**, explicitly annotated, to reflect reported current structure without widening permissions. Later trigger/ownership-transfer INSERT values are retained unchanged; they are separate behavior. Confirm these defaults directly before accepting a baseline. |
| 13 tables have no explicit positive table GRANT in history | `profiles`, `locations`, `instructors`, `students`, `expenses`, `user_roles`, `staff_invitations`, `student_payments`, `batches`, `gallery_items`, `recordings`, `live_classes`, `settings`. No grants were guessed from RLS intent. Their unresolved ACL comments mean this file is **not deployable as-is**. Other tables retain recorded grants, not certified live ACLs. |
| Extension/default-role privilege state is missing | Historical blanket routine revocation affected all then-existing public routines, potentially including extension routines. Reference resolves only known application routine ACLs, not unrelated managed routines; role attributes, owners, inherited grants and default privileges remain unverified. |
| Storage provisioning is outside schema | Four buckets were inserted historically; `member-photos` creation is absent. Metadata/context reports private `member-photos`, `studio-gallery`, `studio-recordings`, public `studio-logos`, `studio-backgrounds`. Storage policies are included, bucket rows/files and managed storage DDL are not. |
| Managed prerequisites | `auth.users`, `auth.uid()`, `storage.objects`, `storage.foldername()`, service roles and `supabase_realtime` publication must exist. Preserve historical auth-user foreign keys; do not reinterpret this as standalone PostgreSQL support. |
| Crypto and scheduler | Slug function needs `gen_random_bytes`; pgcrypto installation/schema resolution is absent. `pg_cron` creation is recorded as a commented dependency; version/schema/configuration are unknown. No cron job schedule is defined in these migrations. |
| Normalized default text differs | Metadata includes inferred casts such as `'cash'::text`, typed array literals and an alternative timezone spelling. These are documented formatting/type-inference differences, not the four boolean-default drift findings. Execution-level equivalence has not been tested. |

## Existing behavior risks — preserved, not fixed

- Recording public metadata RPCs omit `expires_at`, whereas public file-read policies enforce it. Expired metadata can remain visible until lifecycle maintenance archives the recording.
- Final ownership transfer predates face enrollments; it does not transfer their owner IDs or rewrite private storage owner-prefix paths, and resets only the earlier permission columns.
- Descriptor SELECT permits workspace-wide eligible staff, unlike assigned-member photo access; face-write policies do not assert the enrollment batch equals the student's batch. Existing policies are retained exactly.
- Destructive historical account cleanup/backfills make the original migration chain unsuitable for replay into an empty environment. They are deliberately absent from this schema-only reference.

## Manual checks before treating it as an authoritative baseline

Ask the database administrator for **schema-only catalog definitions**, not account rows, media or credentials, and compare:

1. Applied migration ledger against the 70 available filenames; recover any missing files and identify unrecorded changes.
2. Full `settings` DDL and all table constraints, index expressions/predicates, FK actions and validation flags against the reference.
3. Table/routine ACLs, default privileges, schema USAGE, function owners/security/search paths, RLS enable/FORCE flags, policy roles and USING/WITH CHECK predicates.
4. Current defaults for the four staff-permission columns, plus enum/array types and numeric precision.
5. App-owned auth/storage triggers, bucket privacy/settings, realtime membership/replica identities, extension versions/schema paths and lifecycle schedule.
6. Only after catalog gaps are resolved, validate an isolated authorized test environment and exercise email/phone/Google/recovery, Owner/Staff isolation, public join/terms, payments/renewals, attendance/private-photo descriptors, media lifecycle and ownership transfer.

**Do not apply schema.sql to the existing database or replace its migration history.** This artifact documents the reconstructable final schema and its precise verification limits; it contains no application data or managed-service configuration backup.
