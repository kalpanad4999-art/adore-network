# Feature development

1. Read AGENTS.md and trace the existing feature's handlers, backend operations and permissions.
2. Change the smallest responsible layer: presentation, pure rules, workflow/state or service.
3. Reuse shared UI and semantic tokens. Create only feature folders that are needed.
4. Keep workspace filters and server policies; hidden buttons are not authorization.

## Members examples
- Form field: deliberately update contracts, form binding, validation and payload. Schema changes need separate review.
- Validation: test `rules/memberValidation.ts` including limits; public Join remains distinct.
- Backend replacement: implement named operations in `services/memberService.ts`, not query builders in a screen.
- Photo-save change: test `services/memberWorkflow.ts` ordering and every failure branch.
- Loading/subscriptions: update `hooks/useMembers.ts` and test disposal.

## Checks
```sh
bunx vitest run src/features/members src/test/photoAttendance.test.ts src/test/routeGuards.test.tsx
bun run test
bunx eslint src/pages/Customers.tsx src/features/members src/test/photoAttendance.test.ts
bun run lint
```
Full-repository lint has pre-existing failures; record separately, not an unrelated rewrite. Recognition-filter tests mock only imported dependencies to test filtering; they do not exercise models or pretend to identify people. Do not install Node TensorFlow to test browser orchestration.

## Live checks
Use an authorized account, consented reference photo and isolated test records. Create without photo, read back, edit, refresh, and read back. For photos, verify upload/link/enrollment, refresh/signed preview, replacement and old-file cleanup. Exercise assigned Staff and denied access with suitable accounts. Delete only isolated records. Check realtime and console/build errors.

Unavailable accounts/photos must be reported as blockers. Empty/access-denied screenshots and mocked SDK tests do not verify live saves, recognition or policies.
