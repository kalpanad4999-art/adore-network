# Backend contracts

## Members service
| Operation | Preserved behaviour |
| --- | --- |
| list | Workspace-scoped students, name order, custom-data normalization |
| listBatches | Workspace batches newest first, custom-field normalization |
| listStaff | Staff roles then profile display names; Owner-only invocation by hook |
| save | Insert/update member; return existing ID and prior photo path |
| uploadPhoto/linkPhoto | Private upload with original content type, then link existing member |
| photoUrl | 300-second private signed URL |
| restorePhoto/removePhoto | Original rollback/cleanup, returned errors nonblocking |
| assignStaff/move | Existing member assignment or batch-only update |
| deletePayments/deleteRecord | Payments first, then member; no new cascading or storage deletion |
| saveBatch/deleteBatch | Original batch operations used by Members |
| subscribe | Workspace students/batches changes and channel disposal |

Read errors returning no data still produce empty lists as before. Member-save/upload/link/delete errors throw. Assignment/move/batch-save return existing backend error results for page toasts. Cleanup returned errors remain unchecked; network rejections can propagate. These compatibility choices are not claims of atomicity or ideal recovery.

## Photo sequence
1. Save member fields and retrieve saved ID/prior path.
2. Prepare image locally, retaining existing WebP normalization.
3. Upload `{workspaceId}/{savedMemberId}/{uuid}.png|jpg` privately.
4. Link new path on member.
5. Enroll descriptor using current browser recognition.
6. Only on success remove old photo.

Upload failure stops before linking. Link failure removes new upload. Enrollment failure restores prior path before removing new upload. Member-field changes are not rolled back. Reliability changes require separate approval.

Deletion preserves payments-then-member, without adding storage removal. Move updates the member batch only; enrollment synchronization changes are outside this refactor. Custom values retain the existing 500-character truncation.

## Cross-application dependencies
Before Python migration, inventory auth/session/OAuth, storage visibility/signed URLs, realtime, SQL functions for public studio/media, batch-token registration, invitations, ownership transfer, gallery cleanup and class lifecycle. Four current backend functions handle phone login, support chat, account transfer and class lifecycle.

Preserve IDs, terms/required-field validation and access controls. This is a source operation map, not certification of deployed policies or hosted auth settings. No privileged keys or direct database credentials belong in React.
