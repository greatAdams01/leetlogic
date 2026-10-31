# Account role authentication

Deploy the database migration, rebuild `@leetlogic/contracts`, and release the API and clients together. Old clients that used login to create accounts must upgrade: `/auth/otp/request` and `/auth/otp/verify` default to LOGIN, which only accepts an existing account. Registration sends `intent: "REGISTER"` and `role: "BUYER" | "SELLER"` in both requests. OTP challenges are bound to that intent and registration role. Login ignores any submitted role.

Phone uniqueness prevents concurrent duplicate registrations. The unique user capability index prevents assigning two roles. Seller profile creation cannot grant or change roles. Every authenticated request reloads the account's current role; old tokens and local role preferences cannot restore extra privileges. Accounts without exactly one role fail closed, including token refresh.

The migration records users with zero or multiple roles in `account_role_conflicts`, including their previous roles. Historical accounts with a farmer profile retain SELLER and lose the automatic BUYER grant. Conflicting accounts without a farmer profile have their grants removed and require support review. No users, orders, profiles or phone numbers are deleted. Accounts with a single valid role are unchanged.

After deployment, review `SELECT * FROM account_role_conflicts ORDER BY recorded_at, user_id;`. For ambiguous accounts, verify the intended role and historical trades before assigning exactly one capability in an audited support operation. Do not infer a new role from a login request. The account's phone number remains reserved, so re-registration cannot bypass review.

The mobile app routes authenticated sellers to Seller Home (or unfinished seller onboarding), and buyers to the marketplace. The web account page uses the registered role for its dashboard heading and order feed; seller onboarding and listing management remain in the mobile app.
