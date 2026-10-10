import Screen0 from "./screens/login";
import Screen1 from "./screens/dashboard";
import Screen2 from "./screens/users";
import Screen3 from "./screens/logistics";
import Screen4 from "./screens/security";
import Screen5 from "./screens/verification";
import Screen6 from "./screens/verification-buyer";
import Screen7 from "./screens/verification-farmer";
import Screen8 from "./screens/support";
import Screen9 from "./screens/dispute-sidebar";
import Screen10 from "./screens/dispute-workspace";
import Screen11 from "./screens/support-ticket";
import Screen12 from "./screens/support-chat";
import Screen13 from "./screens/faq";
import Screen14 from "./screens/disputes-claim";
import Screen15 from "./screens/risk";
import Screen16 from "./screens/orders";
import Screen17 from "./screens/withdrawals";
import Screen18 from "./screens/compliance";
import Screen19 from "./screens/reports";
import Screen20 from "./screens/roles";
import Screen21 from "./screens/settings";
import Screen22 from "./screens/listings";
import Screen23 from "./screens/listings-review";
import Screen24 from "./screens/translations";
import Screen25 from "./screens/audit";
import Screen26 from "./screens/reconciliation";
import Screen27 from "./screens/system";
import DisputeSidebar from "./screens/dispute-sidebar";
import DisputeWorkspace from "./screens/dispute-workspace";

function Disputes() {
  return (
    <div className="admin-dispute-layout">
      <DisputeSidebar />
      <DisputeWorkspace />
    </div>
  );
}

export const adminScreens = {
  login: { component: Screen0, title: "Staff login" },
  dashboard: { component: Screen1, title: "Good morning, Amaka" },
  users: { component: Screen2, title: "B2.25 \u00b7 User directory & account controls" },
  logistics: { component: Screen3, title: "B2.28 \u00b7 Logistics & freight dispatch" },
  security: { component: Screen4, title: "Staff security code" },
  verification: { component: Screen5, title: "Farmer queue" },
  "verification/buyer": { component: Screen6, title: "Buyer verification \u00b7 Ikeja Foods" },
  "verification/farmer": { component: Screen7, title: "Staff verification \u2014 Chibuzor Simon" },
  support: { component: Screen8, title: "Support & dispute ticket queue" },
  "support/ticket": { component: Screen11, title: "Support workspace" },
  "support/chat": { component: Screen12, title: "Live chat console" },
  faq: { component: Screen13, title: "Faq admin" },
  "disputes/claim": { component: Screen14, title: "Dispute claim detail" },
  risk: { component: Screen15, title: "Fraud alert" },
  orders: { component: Screen16, title: "Order detail and escrow" },
  withdrawals: { component: Screen17, title: "Withdrawal authorization \u00b7 Chibuzor Simon" },
  compliance: { component: Screen18, title: "Export compliance review" },
  reports: { component: Screen19, title: "Operational reports & analytics \u2014 October 2024" },
  roles: { component: Screen20, title: "Roles" },
  settings: { component: Screen21, title: "Marketplace and escrow settings" },
  listings: { component: Screen22, title: "Produce listings queue" },
  "listings/review": { component: Screen23, title: "Review produce listing: Fresh Roma Tomatoes" },
  translations: { component: Screen24, title: "Translations" },
  audit: { component: Screen25, title: "Audit log & system activity trail" },
  reconciliation: {
    component: Screen26,
    title: "Escrow ledger reconciliation \u00b7 Daily audit (24 Oct 2024)",
  },
  system: { component: Screen27, title: "System status and maintenance" },
  disputes: { component: Disputes, title: "Dispute & resolution queue" },
};
