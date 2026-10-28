# Farmer paid-order notifications

Farmers can open **Menu → Security settings** to change their PIN or biometric unlock preference. Changes require the current PIN; enabling biometrics also requires device authentication.

Seller order lists and seller delivery access require an escrow `FUND` record. Unpaid and cancelled checkout orders stay in the buyer's order history. Refunded orders with prior funding remain visible as financial history.

A successful provider-confirmed order payment writes one `PaidOrderNotification` in the funding transaction. Repeated reconciliation and shipping top-ups do not create another paid-order alert. The mobile inbox includes these records for the owning farmer, alongside delivery updates. New notifications apply to payments confirmed after this change; historical payments are not backfilled.

## Enable phone alerts

1. Apply database migrations with `pnpm --filter @leetlogic/database exec prisma migrate deploy` in the target environment.
2. Configure an Expo EAS project and set `EXPO_PUBLIC_EAS_PROJECT_ID` when building the mobile app (or set `extra.eas.projectId` in Expo config).
3. Configure the project's Android FCM and iOS APNs push credentials. Build and install the app with the `expo-notifications` native plugin; Expo Go cannot receive these remote alerts.
4. Keep the existing payment worker running: `pnpm --filter @leetlogic/api worker:payments`. It processes the notification outbox every 15 seconds independently of payment-provider polling.
5. In the farmer Menu, tap **Enable paid-order notifications** and grant notification permission. Existing granted permission is registered again on app open and foreground entry. The app reports a configuration error if the installed build has no EAS project ID.
6. If Expo push security is enabled for the project, set `EXPO_ACCESS_TOKEN` on the API worker.

Tokens are associated with the authenticated account and session family, so refresh-token rotation preserves registration and revoked sessions cannot receive new sends. The worker retries gateway errors, claims jobs to avoid simultaneous sends by multiple workers, and removes tokens rejected as unregistered. Delivery is at least once; a network timeout after Expo accepts a message can result in a duplicate alert. Notification inbox entries remain unique per order. Expo acceptance is not proof that the operating system displayed an alert; device permissions, credentials, connectivity and system policies also apply.

Notification taps open the paid order after farmer unlock and only when the notification's account matches the signed-in farmer. Alerts contain generic copy; order details remain inside the authenticated app.

Reference: https://docs.expo.dev/push-notifications/push-notifications-setup/
