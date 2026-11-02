"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

type Item = { path: string; label: string; permission: string };
type Section = { id: string; label: string; items: Item[] };
const sections: Section[] = [
  {
    id: "listings",
    label: "Listings",
    items: [
      { path: "listings", label: "Listings queue", permission: "catalog.manage" },
      { path: "categories", label: "Categories", permission: "catalog.manage" },
    ],
  },
  {
    id: "verifications",
    label: "Verifications",
    items: [
      { path: "verification", label: "Farmer verification", permission: "verification.read" },
      { path: "verification/buyer", label: "Buyer verification", permission: "users.read" },
    ],
  },
  {
    id: "orders",
    label: "Orders & delivery",
    items: [
      { path: "orders", label: "Orders & escrow", permission: "orders.read" },
      { path: "logistics", label: "Logistics & dispatch", permission: "orders.read" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { path: "reconciliation", label: "Payments & reconciliation", permission: "payments.read" },
      { path: "withdrawals", label: "Withdrawals", permission: "payments.read" },
      { path: "reports", label: "Reports & analytics", permission: "payments.read" },
    ],
  },
  {
    id: "support",
    label: "Support",
    items: [
      { path: "support", label: "Support tickets", permission: "support.manage" },
      { path: "disputes", label: "Dispute queue", permission: "disputes.manage" },
    ],
  },
  {
    id: "trust",
    label: "Risk & compliance",
    items: [
      { path: "risk", label: "Fraud & risk", permission: "risk.manage" },
      { path: "compliance", label: "Export compliance", permission: "compliance.manage" },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { path: "faq", label: "FAQ admin", permission: "content.manage" },
      { path: "translations", label: "Translations", permission: "content.manage" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { path: "users", label: "Users", permission: "users.read" },
      { path: "roles", label: "Roles & permissions", permission: "admin.manage" },
      { path: "settings", label: "Marketplace settings", permission: "settings.manage" },
      { path: "audit", label: "Audit log", permission: "audit.read" },
      { path: "system", label: "System status", permission: "system.manage" },
    ],
  },
];

export function SidebarNavigation({
  route,
  permissions,
  onNavigate,
}: {
  route: string;
  permissions: readonly string[];
  onNavigate: () => void;
}) {
  const id = useId();
  const visible = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => permissions.includes(item.permission)),
    }))
    .filter((section) => section.items.length);
  const activeItem = visible
    .flatMap((section) => section.items)
    .filter((item) => route === item.path || route.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const activeSection = visible.find((section) => section.items.includes(activeItem!))?.id;
  const [selection, setSelection] = useState<{ route: string; section: string | null }>({
    route,
    section: activeSection ?? null,
  });
  useEffect(() => {
    setSelection({ route, section: activeSection ?? null });
  }, [route, activeSection]);
  // Navigation opens the destination's group; users can still collapse it manually.
  const openSection = selection.route === route ? selection.section : activeSection;
  return (
    <nav aria-label="Staff workspaces">
      {permissions.includes("orders.read") && (
        <Link
          href="/admin/dashboard"
          aria-current={route === "dashboard" ? "page" : undefined}
          onClick={onNavigate}
        >
          Dashboard
        </Link>
      )}
      {visible.map((section) => {
        const open = openSection === section.id;
        const panelId = `${id}-${section.id}`;
        return (
          <div className="live-nav-section" key={section.id}>
            <button
              type="button"
              className="live-nav-toggle"
              aria-expanded={open}
              aria-controls={panelId}
              data-active={section.id === activeSection || undefined}
              onClick={() => setSelection({ route, section: open ? null : section.id })}
            >
              <span>{section.label}</span>
              <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
                <path
                  d="m6 4 4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <ul id={panelId} className="live-nav-submenu" hidden={!open}>
              {section.items.map((item) => (
                <li key={item.path}>
                  <Link
                    href={`/admin/${item.path}`}
                    aria-current={activeItem === item ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
