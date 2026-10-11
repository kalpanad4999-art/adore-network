# Architecture

## Runtime and existing modules
React/Vite renders pages; AuthContext manages sessions; StudioContext resolves workspace ownership, permissions, branding and locks. Route gates are UI controls, not security enforcement. Lovable Cloud database/storage policies remain the actual access boundary.

| Area | Entry points |
| --- | --- |
| Members/batches | `src/pages/Customers.tsx` |
| Payments/receipts | `src/pages/Payments.tsx`, receipt dialog |
| Renewals/offers | `src/pages/Renewals.tsx`, `Offers.tsx`, `src/lib/offers.ts` |
| Attendance | `src/pages/Attendance.tsx`, `src/lib/photoAttendance.ts` |
| Gallery/classes | `src/pages/Gallery.tsx`, `Media.tsx`, public media pages |
| Learning insights | `src/pages/LearningInsights.tsx`, report dialog |
| Settings/staff | Settings page and cards, StaffPermissionsCard |
| Auth/invitations/public registration | auth pages, AcceptInvitation, Join |
| Navigation | `src/App.tsx`, `src/components/layout/` |

## Members after Phase 1
```text
Customers.tsx (same forms/dialogs)
  -> useMembers: lists, staff options, grouping, realtime disposal
       -> memberService: named Cloud operations
  -> memberPayload: pure existing validation
  -> saveMemberWithPhoto / deleteMember: ordered orchestration
       -> memberService + injected existing recognition functions
  -> CustomerDetailsTable: shared rendering/export controls
```

Contracts live in `src/features/members/types.ts`; the table retains its exported CustomerRow alias. Form/dialog state stays in the page to avoid needless abstraction. Other screens retain direct backend calls until separately approved; this is not an application-wide service migration yet.

Private photos stay in `member-photos/{ownerId}/{memberId}/`, referenced by existing member IDs. Browser recognition stays behind photoAttendance with models under `/models`; descriptors remain in the existing enrollment table under workspace policies. Public Join keeps separate SQL registration/terms validation. Existing providers, navigation, auth and backend functions are unchanged.

## Later Python migration
There is no Django/FastAPI/Laravel backend in this checkout. A future separately hosted Python service can replace named adapter operations after equivalence testing. Authentication, private storage, realtime, SQL functions, authorization and multi-step ordering require explicit contracts; CRUD alone is insufficient. Do not introduce duplicate writers or migrate data automatically.
