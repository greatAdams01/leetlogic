# Staff operations in the existing Next.js app

`/admin` uses the existing Express API and PostgreSQL database. The original Figma screen files remain as design references; the live entry point is `components/admin/live-admin.tsx`. The original demo wrapper is not mounted. Public pages retain their header/footer.

## Access

Staff sign in with **email + password + an authenticator**. Customer phone OTP is unchanged. The initial account completes authenticator enrollment at first login; recovery codes are displayed once. Email setup/reset links expire and are single-use. Suspensions, logout, password resets, and changed roles invalidate access. Requests check active database sessions and current permissions, not just JWT claims.

The Next route `/api/admin/[...path]` proxies to `ADMIN_API_URL` (default `http://localhost:3000`). Access, refresh, device, and pre-auth tokens use HttpOnly SameSite=Strict cookies. Production cookies require HTTPS; write requests require the same origin. Credentials are not put in localStorage or exposed through browser JSON responses.

## Persistent workflows

- Dashboard: database counts and held escrow.
- Users: search, pagination, status changes, and session revocation.
- Verification: queue, expiring private document links, atomic approval/rejection, and audit.
- Listings: moderation gated by farmer verification.
- Orders: inventory reservation, funding references, full refund/release, unpaid cancellation, platform fee snapshots/net wallet credit, and ledger reconciliation.
- Logistics: carrier assignment, tracking reference, delivery evidence, and validated status transitions.
- Withdrawals: wallet reservation, authorization/rejection, and balance protection.
- Support/disputes: ticket creation, assignment, messages/internal notes, resolution, and blocking escrow on open disputes.
- FAQ/translations/incidents: create/edit/publish. Published FAQs feed the public site's FAQ; published translations/status are available under `/v1/content`.
- Risk/compliance: persisted alerts, documents/references, and review decisions.
- Roles: email invitations, resend, assignment/suspension, permission-aware menus.
- Settings: database storage, version conflicts, authenticator step-up.
- Reports/audit: real aggregates and paginated audit records. CSV exports contain the currently loaded page and neutralize spreadsheet formulas.

Sensitive financial/settings/access actions require a fresh authenticator check. Mutations write their audit entry in the same transaction. Escrow submissions carry an idempotency identifier; balances and foreign keys have database constraints. Funded order settlement requires the full held amount.

Verification uploads accept PDF/PNG/JPEG files (up to 10 MB) at `/v1/seller/verification/uploads?documentType=NIN_SLIP` with customer authorization and the matching content type. Set `PRIVATE_STORAGE_ROOT` to private persistent storage in production. Document reads check staff authorization, link expiration, safe paths, and stored SHA-256 checksums.

## External services

Email defaults to console delivery in development; setup links are printed in the backend terminal. Configure `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, a verified `ADMIN_EMAIL_FROM`, and `ADMIN_WEB_URL` for real delivery. Console delivery is refused in production.

The financial screens manage the **internal ledger**. Funding requires an already verified external payment reference. Withdrawal authorization reserves funds; it does not send a bank transfer. Actual payment collection, external refunds, bank payouts, and carrier tracking integrations require provider credentials and webhook integration. These are stated in the financial review screens; authorization is never reported as a completed payout.

## Running and verification

Run PostgreSQL/Redis with `docker compose up -d postgres redis`, apply `pnpm --filter @leetlogic/database exec prisma migrate deploy`, generate with `pnpm db:generate`, and seed roles using `node --env-file=../../.env --import tsx prisma/seed.ts` from `packages/database`. Start `pnpm dev` and `pnpm dev:web` in separate terminals.

For an initial invitation, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_NAME` before seeding, then request a setup link through Forgot password. Seed adds missing foundation grants without deleting existing role permissions.

Unit checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Database integration suite: from `apps/api`, run `node --env-file=../../.env scripts/test-admin.mjs`. This uses PostgreSQL schema `leetlogic_admin_integration` and Redis database 15; test records never enter the public schema. Keep Redis database 15 dedicated to tests.
