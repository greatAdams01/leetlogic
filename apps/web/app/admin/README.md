# Staff operations UI

The 27 screens in Figma section `2521:42052` are implemented in this existing Next.js application at `/admin`. Individual screens use routes such as `/admin/verification`, `/admin/orders`, `/admin/settings`, and `/admin/login`. The Workspaces menu provides access to every screen, including the detail routes.

`components/admin/screens.tsx` is the route registry. Shared native controls and interactions live in `components/admin/controls.tsx` and `workspace.tsx`. Screen styles are scoped under `.admin-design`; Figma assets are local files in `public/admin-assets`. Public pages keep their existing header and footer through `PublicFrame`.

## Current data and behavior

These screens use the Figma sample records. Search and verification filters operate on those records; review buttons open the supplied detail screens; exports download sample CSV data. Editable fields and switches are native controls. Save actions retain local demo drafts. Other actions create a clearly labeled demo review, without changing production records.

The UI is not an authentication boundary. Login and MFA screens are visual implementations only and do not grant access to live data. Do not insert live personal, financial, or operational records into the sample screens before adding server-side authentication and permission checks.

## Backend integration

The existing Express API supports phone OTP and TOTP at the admin auth routes, plus verification read/decision, invitation, and audit-log endpoints. The Figma login uses work email and password/SSO, so it requires an agreed authentication flow before connection. Additional operational APIs are needed for the remaining screens. Replace sample data through typed adapters and retain API authorization; do not wire demo financial actions directly to writes.

Validation: `pnpm --filter @leetlogic/web typecheck` and `pnpm --filter @leetlogic/web build`. Desktop and phone viewport checks cover every route and locally rendered asset.
