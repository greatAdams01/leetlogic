"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdminFilterContext } from "./controls";

const workspaces = [
  ["dashboard", "Dashboard"],
  ["verification", "Verification queue"],
  ["listings", "Listings queue"],
  ["orders", "Orders & escrow"],
  ["logistics", "Logistics & dispatch"],
  ["reconciliation", "Reconciliation"],
  ["withdrawals", "Withdrawals"],
  ["disputes", "Dispute queue"],
  ["users", "Users"],
  ["support", "Support tickets"],
  ["support/chat", "Live chat"],
  ["faq", "FAQ admin"],
  ["risk", "Fraud & risk"],
  ["compliance", "Export compliance"],
  ["reports", "Reports & analytics"],
  ["roles", "Roles & permissions"],
  ["settings", "Marketplace settings"],
  ["translations", "Translations"],
  ["audit", "Audit log"],
  ["system", "System status"],
  ["login", "Staff login"],
] as const;

export function AdminWorkspace({
  route,
  title,
  children,
}: {
  route: string;
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [menu, setMenu] = useState(false);
  const [action, setAction] = useState("");
  const [notice, setNotice] = useState("");
  const [noResults, setNoResults] = useState(false);
  const [filter, setFilter] = useState(route === "faq" ? "✓ Farmers" : "All");
  const [query, setQuery] = useState("");
  const auth = route === "login" || route === "security";

  useEffect(() => {
    if (action) dialog.current?.showModal();
    else dialog.current?.close();
  }, [action]);
  useEffect(() => {
    setAction("");
    setMenu(false);
    setFilter(route === "faq" ? "✓ Farmers" : "All");
    setQuery("");
    setNoResults(false);
  }, [route]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const search = (event: Event) => setQuery(String((event as CustomEvent).detail || ""));
    element.addEventListener("admin-search", search);
    return () => element.removeEventListener("admin-search", search);
  }, [route]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const matches = (text: string) =>
      text.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All" || text.toLowerCase().includes(filter.toLowerCase()));
    const rows = Array.from(
      element.querySelectorAll<HTMLElement>(
        '[data-name="Record"], [data-name="Listing moderation row"], [data-name="User record"], [data-name="Ticket row"], [data-name="Dispute row"], [data-name="Audit row"], [data-name="Service incident log row"]',
      ),
    );
    const columns = Array.from(element.querySelectorAll<HTMLElement>('[data-name="Column"]')).map(
      (column) =>
        Array.from(column.children).filter(
          (cell): cell is HTMLElement =>
            cell instanceof HTMLElement && cell.dataset.name === "Table cell",
        ),
    );
    let visible = 0;
    rows.forEach((row) => {
      const show = matches(row.textContent || "");
      row.hidden = !show;
      if (show) visible++;
    });
    if (columns.length) {
      columns[0].forEach((_, index) => {
        const show = matches(columns.map((column) => column[index]?.textContent || "").join(" "));
        columns.forEach((column) => {
          if (column[index]) column[index].hidden = !show;
        });
        if (show) visible++;
      });
    }
    setNoResults((rows.length > 0 || columns.length > 0) && visible === 0);
  }, [query, filter, route]);

  function exportCsv() {
    const lines = Array.from(
      root.current?.querySelectorAll<HTMLElement>(
        '[data-name="Record"], [data-name$="row"], [data-name="Table cell"]',
      ) || [],
    )
      .filter((element) => !element.hidden)
      .map(
        (element) =>
          `"${(element.textContent || "").replace(/\s+/g, " ").trim().replace(/"/g, '""')}"`,
      );
    const csv = lines.length
      ? ["Demo record", ...lines].join("\r\n")
      : `Demo workspace\r\n"${route}"\r\n"${(root.current?.innerText || "").replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `leetlogic-${route.replaceAll("/", "-")}-demo.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Demo records exported.");
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a, input, select, textarea")) return;
    const button = target.closest<HTMLElement>("[data-admin-control], [data-admin-link]");
    if (
      !button ||
      button.getAttribute("role") === "switch" ||
      button.dataset.name === "Filter chip"
    )
      return;
    const label = button.textContent?.replace(/\s+/g, " ").trim() || "Review setting";
    if (/export|download.*csv/i.test(label)) {
      exportCsv();
      return;
    }
    if (/reset to defaults/i.test(label)) {
      localStorage.removeItem(`leetlogic-admin-demo-${route}`);
      document.dispatchEvent(new Event("admin-reset-defaults"));
      setNotice("Demo settings reset to their design defaults.");
      return;
    }
    if (/log.?out|sign.?out/i.test(label)) {
      router.push("/admin/login");
      return;
    }
    if (/view|review|open/i.test(label)) {
      const detail: Record<string, string> = {
        verification: "verification/farmer",
        listings: "listings/review",
        disputes: "disputes/claim",
        support: "support/ticket",
      };
      if (detail[route]) {
        router.push("/admin/" + detail[route]);
        return;
      }
    }
    if (
      /All|Pending|Approved|Flagged|Waiting|Active|Resolved/i.test(label) &&
      /chip|filter|tab/i.test(button.dataset.name || "")
    ) {
      setFilter(label.startsWith("All") ? "All" : label.replace(/\s*\(.*\)/, ""));
      return;
    }
    setAction(label);
  }

  return (
    <AdminFilterContext.Provider value={{ filter, setFilter }}>
      <div
        ref={root}
        className={`admin-workspace ${auth ? "admin-auth" : ""}`}
        onClick={handleClick}
      >
        <h1 className="admin-sr-only">{title}</h1>
        <div className="admin-demo-tools">
          <span>Demo workspace</span>
          <button
            type="button"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-controls="admin-workspaces"
          >
            Workspaces ☰
          </button>
        </div>
        {menu && (
          <nav
            id="admin-workspaces"
            className="admin-workspace-menu"
            aria-label="All staff workspaces"
          >
            {workspaces.map(([path, title]) => (
              <Link
                key={path}
                href={`/admin/${path}`}
                aria-current={path === route ? "page" : undefined}
              >
                {title}
              </Link>
            ))}
            <Link href="/admin/verification/buyer">Buyer verification</Link>
            <Link href="/admin/security">Security code</Link>
          </nav>
        )}
        {children}
        {noResults && (
          <div className="admin-empty" role="status">
            No records match your search.{" "}
            <button
              onClick={() => {
                setQuery("");
                setFilter("All");
                document.dispatchEvent(new Event("admin-clear-search"));
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="admin-notice">
            {notice}
            <button aria-label="Dismiss notification" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        <dialog
          ref={dialog}
          className="admin-dialog"
          onCancel={() => setAction("")}
          onClick={(event) => event.stopPropagation()}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const fields = Array.from(
                root.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
                  "input, select",
                ) || [],
              )
                .filter((field) => field.type !== "password" && !/code|email/i.test(field.name))
                .map((field) => [field.name || field.getAttribute("aria-label"), field.value]);
              if (/save|update/i.test(action)) {
                localStorage.setItem(`leetlogic-admin-demo-${route}`, JSON.stringify(fields));
                document.dispatchEvent(new Event("admin-draft-saved"));
              }
              const notes = new FormData(event.currentTarget).get("notes") || "";
              sessionStorage.setItem(
                "leetlogic-admin-last-demo-action",
                JSON.stringify({ route, action, notes }),
              );
              setNotice(
                `${action.replace(/→/g, "").trim()}: recorded in this demo. No live records changed.`,
              );
              dialog.current?.close();
              setAction("");
            }}
          >
            <h2>{action}</h2>
            <p>
              {auth
                ? "Staff sign-in is not connected yet. You can explore the demo workspace while account access is being configured."
                : "Review this action using the sample data. Changes here apply to the demo only."}
            </p>
            {!auth && (
              <label>
                Internal notes
                <textarea name="notes" placeholder="Add context for the review…" rows={4} />
              </label>
            )}
            <div className="admin-dialog-actions">
              <button
                type="button"
                onClick={() => {
                  dialog.current?.close();
                  setAction("");
                }}
              >
                Cancel
              </button>
              {auth ? (
                <Link href="/admin">Explore demo</Link>
              ) : (
                <button type="submit">Confirm demo action</button>
              )}
            </div>
          </form>
        </dialog>
      </div>
    </AdminFilterContext.Provider>
  );
}
