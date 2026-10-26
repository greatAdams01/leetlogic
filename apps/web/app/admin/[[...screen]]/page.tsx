import { notFound } from "next/navigation";
import { adminScreens } from "../../../components/admin/screens";
import { LiveAdmin } from "../../../components/admin/live-admin";
import { Suspense } from "react";

type Props = { params: Promise<{ screen?: string[] }> };

export async function generateMetadata({ params }: Props) {
  const route = (await params).screen?.join("/") || "dashboard";
  const screen = adminScreens[route as keyof typeof adminScreens];
  return { title: titles[route] || screen?.title || "Staff operations" };
}

export default async function AdminPage({ params }: Props) {
  const route = (await params).screen?.join("/") || "dashboard";
  const screen = adminScreens[route as keyof typeof adminScreens];
  if (!screen && !["setup", "forgot-password", "categories"].includes(route)) notFound();
  return (
    <Suspense fallback={<p>Loading staff workspace…</p>}>
      <LiveAdmin route={route} title={titles[route] || screen?.title || "Staff account setup"} />
    </Suspense>
  );
}

const titles: Record<string, string> = {
  dashboard: "Operations dashboard",
  categories: "Listing categories",
  users: "User directory",
  logistics: "Logistics & dispatch",
  verification: "Farmer verification queue",
  "verification/buyer": "Buyer accounts & phone verification",
  "verification/farmer": "Farmer verification",
  withdrawals: "Withdrawal authorization",
  reports: "Reports & analytics",
  "listings/review": "Listing review",
  reconciliation: "Escrow reconciliation",
  orders: "Orders & escrow",
  roles: "Roles & permissions",
  faq: "FAQ admin",
  risk: "Fraud & risk",
};
