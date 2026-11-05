# Prevent duplicate payment submissions

- The payment form currently starts an insert on every submit, with no loading state or synchronous guard. Renewals read those payment records.
- Add a synchronous submission lock and disabled loading state to the existing payment form, covering the insert and its existing follow-up work.
- Release the lock after errors or completion; allow a new intentional payment after completion. Do not deduplicate by member, amount or date.
- Keep database structure, renewal calculations, offers, receipts and other screens unchanged.
- Add and run regression tests for rapid repeated submissions, failure recovery and subsequent intentional payments; check the signed-in payment screen without creating real financial records.

## Technical details
Use a small ref-backed submission hook so repeated events cannot race before React updates the button. Keep all existing payment writes in the current handler, with a try/finally release. No migration is needed.