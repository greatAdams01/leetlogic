# Account role authentication

Deploy the database migration, rebuild `@leetlogic/contracts`, and release the API and clients together. Old clients that used login to create accounts must upgrade: `/auth/otp/request` and `/auth/otp/verify` default to LOGIN, which only accepts an existing account. Registration sends `intent: "REGISTER"` and `role: "BUYER" | "SELLER"` in both requests. OTP challenges are bound to that intent and registration role. Login ignores any submitted role.

Phone uniqueness prevents concurrent duplicate registrations. The unique user capability index prevents assigning two roles. Seller profile creation cannot grant or change roles. Every authenticated request reloads the account's current role; old tokens and local role preferences cannot restore extra privileges. Accounts without exactly one role fail closed, including token refresh.

The migration records users with zero or multiple roles in `account_role_conflicts`, including their previous roles. Historical accounts with a farmer profile retain SELLER and lose the automatic BUYER grant. Conflicting accounts without a farmer profile have their grants removed and require support review. No users, orders, profiles or phone numbers are deleted. Accounts with a single valid role are unchanged.

After deployment, review `SELECT * FROM account_role_conflicts ORDER BY recorded_at, user_id;`. For ambiguous accounts, verify the intended role and historical trades before assigning exactly one capability in an audited support operation. Do not infer a new role from a login request. The account's phone number remains reserved, so re-registration cannot bypass review.

The mobile app routes authenticated sellers to Seller Home (or unfinished seller onboarding), and buyers to the marketplace. The web account page uses the registered role for its dashboard heading and order feed; seller onboarding and listing management remain in the mobile app.

## Profile failures after successful verification

`POST /v1/auth/otp/verify` establishes the secure session; `GET /v1/me` separately
loads the profile, capabilities, farmer profile and non-deleted addresses. A
profile outage is **not** an incorrect OTP. Mobile and web retain the session,
hide the consumed code/resend form, and offer a profile retry or explicit logout.
Mobile also resumes this retry state after restart and publishes no account until
the stored role and seller PIN gate are ready. HTTP 401/403 account/session
rejections return to login; temporary refresh failures do not erase valid tokens.
Role conflicts remain fail-closed with support guidance.

Authentication and profile responses use `Cache-Control: no-store`. Web tokens
stay in HttpOnly, SameSite=Strict cookies (Secure in production); mobile uses
SecureStore. Refresh-token hashes and replay/revocation checks are unchanged.
Production console OTP delivery fails closed and never logs a phone or code;
development console codes must remain local. Request logs exclude bodies, query
parameters and authorization headers. Schema errors log only allowlisted Prisma
code/model/table/column metadata, never raw query text or authentication values;
customers receive a generic service message.

### Confirmed local incident: 31 October 2026

The API and Prisma CLI targeted `localhost:5432`, database `leetlogic`, schema
`public`. The exact `/v1/me` query failed with Prisma `P2022` on
`addresses.postcode_verified_at`; `postcode_verification_level` and
`postcode_verification_mode` were also absent. The generated Prisma 6.19.3
datamodel already expected them. All 22 earlier migrations had completed with
unchanged checksums; only `20261031200000_ndaps_address_verification` was pending.
This was not an OTP/session/role failure or a missing packaging/delivery table.

A restricted-permission, validated PostgreSQL custom-format backup was saved
under `apps/api/.private-objects/login-repair/` before applying that existing
additive migration with `prisma migrate deploy`. No reset, `db push`, new repair
migration, dropped table or record deletion was needed. Before/after fingerprints
of existing fields matched across all 67 application tables. Existing addresses
keep nullable verification metadata rather than being falsely marked verified.

### Safe operator workflow

1. Confirm the API's effective `DATABASE_URL` database/schema without logging
   credentials. The root `.env` is shared with Prisma; explicit deployment/shell
   variables take precedence. Do not rotate persistent authentication secrets.
2. Capture sanitized Prisma code/model/table/column metadata from the failing
   profile query. Compare the generated datamodel, actual columns and migration
   history; do not assume the newest migration is the cause.
3. Run `pnpm db:status`, review pending SQL for data preservation, and make a
   validated backup of the intended database. Migration status exits nonzero when
   migrations are pending. Stop if the target, applied checksums or changes are
   unexpected; never accept a reset or apply generated drift SQL blindly.
4. Apply existing reviewed migrations with `pnpm db:deploy`, regenerate with
   `pnpm db:generate`, and run `pnpm --filter @leetlogic/database exec prisma validate`.
   Confirm `pnpm db:status` is current and existing records are intact.
5. Retry `/v1/me` with an existing session, then verify Buyer/Seller login and
   routing. Release/restart compatible API and worker processes after rebuilding
   if they do not load the regenerated client automatically.

## Authentication regression checks

```sh
pnpm --filter @leetlogic/api test:auth
pnpm test
pnpm typecheck
pnpm locales:check
```

`test:auth` requires local PostgreSQL and Redis. It deploys migrations only to a
new `leetlogic_auth_integration_<suffix>` schema, uses dedicated Redis database 12
with a per-run prefix, and retains diagnostic fixtures without flushing Redis,
seeding the application schema or deleting existing data. Only OTP delivery is
mocked in successful flows; hashing, expiration, verification, audits, sessions,
refresh and `/v1/me` queries are real. One fault-injection regression simulates a
profile `P2022` without removing any column. External providers are blocked: tests
send no real SMS, spend no NIPOST credits, buy no labels and collect no payments.
Keep Redis 12 dedicated to authentication tests. Client regressions cover stored
Buyer/Seller routing, profile-only retries, restart, PIN gating and late responses.

### Repair verification results (31 October 2026)

| Check | Result |
| --- | --- |
| Effective application target | `localhost:5432/leetlogic`, schema `public`; all 23 migrations completed with unchanged checksums. |
| Prisma | Client 6.19.3 regenerated; generated/source datamodels match, no mapped columns are absent, and schema validation passes. |
| Data preservation | All 67 application-table fingerprints matched during the migration. Counts remain 4 users, 4 role grants, 2 seller profiles, 7 addresses, 14 orders and 5 deliveries. |
| Existing accounts | Exact profile queries succeed for all four accounts. The running API returns `/v1/me 200` for pre-repair Buyer and Seller session records without creating replacement sessions. |
| OTP/profile API integration | 14 checks pass: both stored roles, unknown numbers, wrong/expired/consumed codes, explicit registration, role conflicts, profile outage, existing/revoked sessions and refresh replay protection. |
| Client routing and recovery | Mobile and web regressions pass for stored-role dashboards, profile-only retries, restart/cookie restoration, seller PIN gating, genuine session rejection and late responses. |
| Workspace | `pnpm verify` passes: localization, all builds (including mobile exports), typechecks and 666 workspace tests. |
| Preserved checkout/address work | 77 isolated address/delivery and 50 payment checks pass. The full 77-check suite also passes ten consecutive repeats after giving the address fixture a dedicated loopback listener; locks/assertions remain unchanged. |
| Lint/whitespace | Changed authentication files and fixture lint clean; `git diff --check` passes. Full API/mobile lint still reports the pre-existing `reported-device.ts:10` control-regex error and eight unrelated mobile errors. |

The validated, mode-0600 backup is
`apps/api/.private-objects/login-repair/before-ndaps-2026-10-31T15-25-25-308Z/leetlogic-public.dump`;
the adjacent `before-fingerprints.json` and `after-fingerprints.json` record the
migration comparison. Subsequent OTP/session/login timestamps and payment-worker
activity are normal application writes, not migration-induced data changes; no
attempt was made to undo them. No commits, resets, dropped tables, application
record deletions or live provider calls were made for this repair.

Real SMS delivery and physical-device login QA were not exercised. Production
NIPOST readiness, approval and live-credit/device QA remain separate gates in
[the address rollout guide](nipost-addresses.md).

### Authentication repair file scope

- API cache/error handling: `apps/api/src/routes/auth.ts`,
  `apps/api/src/routes/me.ts`, `apps/api/src/lib/dependency-errors.ts`,
  `apps/api/src/lib/errors.ts` and `apps/api/src/lib/logger.ts`.
- Mobile session/profile recovery: `apps/mobile/src/lib/api.ts`,
  `apps/mobile/src/lib/auth-errors.ts`,
  `apps/mobile/src/screens/verification-entry.tsx` and `apps/mobile/src/state.tsx`.
  Copy/translations are in `apps/mobile/src/lib/localization.ts` and
  `apps/mobile/src/locales/ui.json`.
- Web session/profile recovery: `apps/web/components/customer-account.tsx`,
  `apps/web/app/api/customer/[...path]/route.ts` and `apps/web/lib/customer-api.ts`.
- New API coverage/runner: `apps/api/src/routes/auth.integration.test.ts`,
  `apps/api/src/providers/otp.test.ts` and `apps/api/scripts/test-auth.mjs`;
  existing logger/request-logging and mobile authentication/session/localization
  tests were extended. Web coverage is in `apps/web/lib/customer-auth.test.tsx`
  and `apps/web/lib/customer-session.test.ts`; mobile error categorization is
  covered by `apps/mobile/src/lib/auth-errors.test.ts`.
- Safe command/documentation wiring: `package.json`,
  `packages/database/package.json`, `apps/api/package.json`, `README.md` and this
  guide. The existing NDAPS migration in
  `packages/database/prisma/migrations/20261031200000_ndaps_address_verification/migration.sql`
  was applied, not replaced by a new repair migration. The retained address
  integration fixture in `apps/api/src/routes/addresses.integration.test.ts` now
  guards its test schema/Redis target and reuses a fixture-owned IPv4 listener.
  Earlier NIPOST/nationwide-delivery implementation and bundling changes remain intact.
