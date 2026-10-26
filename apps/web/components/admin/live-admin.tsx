"use client";
import { Categories } from "./categories";
import { ListingQueue, ListingReview } from "./listing-review";
import { VerificationReview, verificationLabel } from "./verification-review";
import { MoneyOperations } from "./money-operations";
import { CustomerDelivery } from "../customer-delivery";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Row = Record<string, any>;
type Staff = { fullName: string; email: string; permissions: string[] };
type Field = {
  choices?: { id: string; label: string }[];
  name: string;
  label: string;
  options?: string[];
  type?: string;
  value?: string | number;
};
const pages = [
  ["dashboard", "Dashboard", "orders.read"],
  ["verification", "Verification queue", "verification.read"],
  ["listings", "Listings queue", "catalog.manage"],
  ["categories", "Listing categories", "catalog.manage"],
  ["orders", "Orders & escrow", "orders.read"],
  ["logistics", "Logistics & dispatch", "orders.read"],
  ["reconciliation", "Reconciliation", "payments.read"],
  ["withdrawals", "Withdrawals", "payments.read"],
  ["disputes", "Dispute queue", "disputes.manage"],
  ["users", "Users", "users.read"],
  ["support", "Support tickets", "support.manage"],
  ["faq", "FAQ admin", "content.manage"],
  ["risk", "Fraud & risk", "risk.manage"],
  ["compliance", "Export compliance", "compliance.manage"],
  ["reports", "Reports & analytics", "payments.read"],
  ["roles", "Roles & permissions", "admin.manage"],
  ["settings", "Marketplace settings", "settings.manage"],
  ["translations", "Translations", "content.manage"],
  ["audit", "Audit log", "audit.read"],
  ["system", "System status", "system.manage"],
];
let refreshInFlight: Promise<Response> | undefined;
async function api(path: string, method = "GET", body?: Row, retry = true): Promise<Row> {
  const response = await fetch(`/api/admin/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = response.status === 204 ? {} : await response.json();
  if (response.status === 401 && retry && !path.startsWith("auth/")) {
    if (!refreshInFlight)
      refreshInFlight = fetch("/api/admin/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).finally(() => {
        refreshInFlight = undefined;
      });
    const refreshed = await refreshInFlight;
    if (refreshed.ok) return api(path, method, body, false);
  }
  if (!response.ok) {
    const message = data.error?.fieldErrors
      ? Object.entries(data.error.fieldErrors)
          .map(([field, errors]) => `${field}: ${(errors as string[]).join(", ")}`)
          .join("; ")
      : data.error?.message;
    const error = new Error(message || "Request failed") as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return data;
}
const email: Field = { name: "email", label: "Work email", type: "email" };
const reason: Field = { name: "reason", label: "Reason / internal notes", type: "textarea" };
const select = (name: string, label: string, options: string[]): Field => ({
  name,
  label,
  options,
});
const text = (name: string, label: string): Field => ({ name, label });
const roleCodes = [
  "SUPER_ADMIN",
  "OPERATIONS_MANAGER",
  "VERIFICATION_OFFICER",
  "FINANCE_DISPUTES_OFFICER",
  "SUPPORT_CONTENT_OFFICER",
];
const content: Record<string, Field[]> = {
  faq: [
    text("question", "Question"),
    { name: "answer", label: "Answer", type: "textarea" },
    select("audience", "Audience", ["FARMERS", "BUYERS", "ALL"]),
    select("locale", "Language", ["en", "pcm", "ig", "ha", "yo"]),
    select("status", "Publication", ["DRAFT", "PUBLISHED"]),
  ],
  translations: [
    text("key", "Translation key"),
    { name: "source", label: "Source text", type: "textarea" },
    { name: "value", label: "Translation", type: "textarea" },
    select("locale", "Language", ["en", "pcm", "ig", "ha", "yo"]),
    select("status", "Publication", ["DRAFT", "PUBLISHED"]),
  ],
  system: [
    text("service", "Service"),
    select("severity", "Severity", ["DEGRADED", "OUTAGE", "MAINTENANCE"]),
    { name: "message", label: "Incident update", type: "textarea" },
    select("status", "Status", ["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
    { name: "isPublic", label: "Public incident", type: "checkbox" },
  ],
  support: [
    text("subject", "Subject"),
    select("kind", "Type", ["SUPPORT", "DISPUTE"]),
    { name: "userId", label: "Customer (optional)", type: "optional" },
    { name: "orderId", label: "Order (required for disputes)", type: "optional" },
    select("priority", "Priority", ["NORMAL", "HIGH", "URGENT"]),
  ],
  orders: [
    text("buyerId", "Buyer"),
    text("listingId", "Produce listing"),
    text("quantity", "Quantity"),
  ],
  logistics: [
    text("orderId", "Funded order"),
    text("carrier", "Carrier"),
    text("trackingRef", "Tracking reference"),
  ],
  withdrawals: [
    text("farmerProfileId", "Farmer"),
    text("amountMinor", "Amount in kobo"),
    text("bankName", "Bank name"),
    text("accountLastFour", "Last four account digits"),
  ],
  risk: [
    text("userId", "Customer"),
    text("title", "Alert title"),
    reason,
    select("severity", "Severity", ["LOW", "MEDIUM", "HIGH"]),
  ],
  compliance: [
    text("orderId", "Order"),
    text("destination", "Destination country"),
    text("documentRef", "Document reference"),
  ],
};
function Fields({ fields, values = {} }: { fields: Field[]; values?: Row }) {
  return (
    <>
      {fields.map((field) => (
        <label key={field.name}>
          {field.label}
          {field.choices ? (
            <select
              name={field.name}
              defaultValue={values[field.name] ?? ""}
              required={field.type !== "optional"}
            >
              <option value="">Select {field.label.toLowerCase()}</option>
              {field.choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
          ) : field.options ? (
            <select
              name={field.name}
              defaultValue={values[field.name] ?? field.value ?? field.options[0]}
            >
              {field.options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              name={field.name}
              defaultValue={values[field.name] ?? ""}
              rows={4}
              required
              maxLength={20000}
            />
          ) : field.type === "checkbox" ? (
            <input type="checkbox" name={field.name} defaultChecked={values[field.name] ?? false} />
          ) : (
            <input
              name={field.name}
              type={field.type === "optional" ? "text" : field.type || "text"}
              defaultValue={values[field.name] ?? field.value ?? ""}
              required={field.type !== "optional"}
              maxLength={field.type === "password" ? 128 : 500}
            />
          )}
        </label>
      ))}
    </>
  );
}
function values(form: HTMLFormElement, fields: Field[]) {
  const data = new FormData(form);
  const body: Row = {};
  for (const field of fields) {
    const value = data.get(field.name);
    if (field.type === "checkbox") body[field.name] = value === "on";
    else if (field.type === "number") body[field.name] = Number(value);
    else if (field.type !== "optional" || value) body[field.name] = value;
  }
  return body;
}
function Auth({ route }: { route: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [stage, setStage] = useState(route === "security" ? "TOTP_CHALLENGE" : "PASSWORD");
  const [recovery, setRecovery] = useState(false);
  const [secret, setSecret] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      if (route === "forgot-password") {
        const result = await api("auth/password/request-reset", "POST", data);
        setNotice(result.message);
      } else if (stage === "PASSWORD") {
        const result = await api(route === "setup" ? "auth/setup" : "auth/login", "POST", {
          ...data,
          ...(route === "setup" ? { token: search.get("token") } : {}),
        });
        setStage(result.next);
        if (result.next === "TOTP_ENROLLMENT") {
          const enrollment = await api("auth/totp/enrol", "POST", {});
          setSecret(enrollment.secret);
        }
      } else if (recovery) {
        const result = await api("auth/recovery", "POST", data);
        setStage(result.next);
        setRecovery(false);
        const enrollment = await api("auth/totp/enrol", "POST", {});
        setSecret(enrollment.secret);
      } else {
        const result = await api("auth/totp/confirm", "POST", data);
        if (result.recoveryCodes) setCodes(result.recoveryCodes);
        else router.replace("/admin");
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="live-auth">
      <Link href="/" className="live-brand">
        LeetLogic <small>Staff portal</small>
      </Link>
      <section className="live-card">
        <div className="live-eyebrow">SECURE STAFF ACCESS</div>
        <h1>
          {codes.length
            ? "Save your recovery codes"
            : route === "forgot-password"
              ? "Reset your password"
              : stage !== "PASSWORD"
                ? "Authenticator verification"
                : route === "setup"
                  ? "Set your password"
                  : "Welcome back"}
        </h1>
        <p>
          {stage === "PASSWORD"
            ? "Use your staff email to access the operations workspace."
            : "Enter the six-digit code from your authenticator app."}
        </p>
        {codes.length ? (
          <>
            <p>Store these codes securely. Each code can be used once to recover access.</p>
            <pre>{codes.join("\n")}</pre>
            <button onClick={() => router.replace("/admin")}>I have saved my codes</button>
          </>
        ) : (
          <form onSubmit={submit}>
            {secret && (
              <div className="live-secret">
                <p>Add a new account to your authenticator using this setup key:</p>
                <code>{secret}</code>
              </div>
            )}
            {stage === "PASSWORD" ? (
              <>
                <Fields
                  fields={
                    route === "setup"
                      ? [
                          {
                            name: "password",
                            label: "New password (at least 12 characters)",
                            type: "password",
                          },
                        ]
                      : route === "forgot-password"
                        ? [email]
                        : [email, { name: "password", label: "Password", type: "password" }]
                  }
                />
              </>
            ) : recovery ? (
              <label>
                Recovery code
                <input name="recoveryCode" autoComplete="off" required />
              </label>
            ) : (
              <label>
                Authenticator code
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </label>
            )}
            {error && (
              <p role="alert" className="live-error">
                {error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            <button disabled={busy}>
              {busy
                ? "Please wait…"
                : route === "forgot-password"
                  ? "Send reset link"
                  : stage === "PASSWORD"
                    ? "Continue securely →"
                    : "Verify & sign in →"}
            </button>
          </form>
        )}
        {stage === "TOTP_CHALLENGE" && !codes.length && (
          <button className="secondary" onClick={() => setRecovery(!recovery)}>
            {recovery ? "Use authenticator instead" : "Use a recovery code"}
          </button>
        )}
        <Link href={route === "forgot-password" ? "/admin/login" : "/admin/forgot-password"}>
          {route === "forgot-password" ? "Back to sign in" : "Forgot your password?"}
        </Link>
      </section>
      <p>Protected with two-factor authentication · LeetLogic operations</p>
    </div>
  );
}
export function LiveAdmin({ route, title }: { route: string; title: string }) {
  if (["login", "security", "setup", "forgot-password"].includes(route))
    return <Auth key={route} route={route} />;
  return <Workspace key={route} route={route} title={title} />;
}
function Workspace({ route, title }: { route: string; title: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resource = route === "verification/buyer" ? "users" : route.split("/")[0]!;
  const endpoint =
    resource === "audit" ? "audit-logs" : resource === "verification" ? "verifications" : resource;
  const [staff, setStaff] = useState<Staff>();
  const [data, setData] = useState<Row>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [selected, setSelected] = useState<Row>();
  const [menu, setMenu] = useState(false);
  const [action, setAction] = useState<{
    label: string;
    path: string;
    fields: Field[];
    values?: Row;
    method?: string;
    stepUp?: boolean;
    extra?: Row;
  }>();
  const dialog = useRef<HTMLDialogElement>(null);
  const reviewPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (resource === "listings" && selected) {
      reviewPanel.current?.focus({ preventScroll: true });
      reviewPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [resource, selected?.id]);
  const can = (permission: string) => staff?.permissions.includes(permission);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const me = await api("me");
      setStaff(me as Staff);
      const records = await api(
        `${endpoint}?page=${page}&search=${encodeURIComponent(query)}&status=${status}`,
      );
      setData(records);
      setSettingsRevision((revision) => revision + 1);
      setSelected((current) =>
        current
          ? (records.items || records.cases || records.logs || []).find(
              (row: Row) => row.id === current.id,
            )
          : undefined,
      );
      const recordId = searchParams.get("id");
      if (recordId && endpoint === "verifications") {
        const detail = await api(`verifications/${recordId}`);
        setSelected(detail.verification);
      } else if (recordId)
        setSelected((records.items || []).find((row: Row) => row.id === recordId));
    } catch (failure) {
      if ((failure as Error & { status?: number }).status === 401) router.replace("/admin/login");
      else setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }, [endpoint, page, query, status, router, searchParams]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (action) dialog.current?.showModal();
    else dialog.current?.close();
  }, [action]);
  useEffect(() => {
    if (!["support", "disputes"].includes(resource) || !staff || action) return;
    const timer = setInterval(() => {
      void api(`${endpoint}?page=${page}&search=${encodeURIComponent(query)}&status=${status}`)
        .then((records) => {
          setData(records);
          setSelected((current) =>
            current ? records.items.find((row: Row) => row.id === current.id) : undefined,
          );
        })
        .catch((failure) => setError((failure as Error).message));
    }, 15000);
    return () => clearInterval(timer);
  }, [resource, endpoint, page, query, status, staff, action]);
  const items: Row[] = data.items || data.cases || data.logs || [];
  async function open(
    label: string,
    path: string,
    fields: Field[],
    options: Partial<NonNullable<typeof action>> = {},
  ) {
    setError("");
    setBusy(true);
    try {
      const sources: Record<string, string> = {
        buyerId: "users",
        userId: "users",
        listingId: "listings",
        orderId: "orders",
        farmerProfileId: "farmers",
      };
      const resolved = await Promise.all(
        fields.map(async (field) => {
          const type = sources[field.name];
          return type ? { ...field, choices: (await api(`lookups?type=${type}`)).items } : field;
        }),
      );
      setAction({ label, path, fields: resolved, ...options });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      if (action.stepUp)
        await api("auth/totp/step-up", "POST", { code: new FormData(form).get("stepUpCode") });
      await api(action.path, action.method || "POST", {
        ...values(form, action.fields),
        ...action.extra,
      });
      setNotice(`${action.label} completed.`);
      setAction(undefined);
      await load();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    const keys = [
      ...new Set(
        items.flatMap((row) => Object.keys(row).filter((key) => typeof row[key] !== "object")),
      ),
    ];
    const cell = (value: unknown) => {
      let string = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(string)) string = "'" + string;
      return `"${string.replaceAll('"', '""')}"`;
    };
    const csv = [
      keys.map(cell).join(","),
      ...items.map((row) => keys.map((key) => cell(row[key])).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leetlogic-${resource}-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const createPermission: Record<string, string> = {
    faq: "content.manage",
    translations: "content.manage",
    system: "system.manage",
    support: "support.manage",
    orders: "orders.manage",
    logistics: "orders.manage",
    withdrawals: "payments.manage",
    risk: "risk.manage",
    compliance: "compliance.manage",
  };
  async function review(row: Row) {
    try {
      if (resource === "verification") {
        const result = await api(`verifications/${row.id}`);
        setSelected(result.verification);
      } else setSelected(row);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  function rowLabel(row: Row) {
    return (
      row.reference ||
      row.title ||
      row.subject ||
      row.question ||
      row.key ||
      row.service ||
      row.profile?.fullName ||
      row.fullName ||
      row.farmerProfile?.farmName ||
      row.action ||
      row.carrier ||
      row.bankName ||
      row.destination ||
      row.id
    );
  }
  return (
    <div className="live-admin">
      <aside className={menu ? "live-sidebar open" : "live-sidebar"}>
        <Link href="/admin" className="live-brand">
          LeetLogic <small>Admin console</small>
        </Link>
        <button
          className="live-sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          ×
        </button>
        <nav aria-label="Staff workspaces">
          {pages
            .filter(([, , permission]) => can(permission!))
            .map(([path, label]) => (
              <Link
                key={path}
                href={`/admin/${path}`}
                aria-current={resource === path ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                {label}
              </Link>
            ))}
        </nav>
        <div className="live-staff">
          <strong>{staff?.fullName || "Staff account"}</strong>
          <small>{staff?.email}</small>
          <button
            onClick={async () => {
              try {
                await api("auth/logout", "POST", {});
                router.replace("/admin/login");
              } catch (failure) {
                setError((failure as Error).message);
              }
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="live-main">
        <header>
          <button
            className="live-menu"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            ☰
          </button>
          <span>Operations workspace</span>
          <span className="live-status">● Staff operations</span>
        </header>
        <div className="live-content">
          {["withdrawals", "reconciliation"].includes(resource) && can("payments.read") && (
            <MoneyOperations manage={can("payments.manage")} />
          )}
          <div className="live-page-heading">
            <div>
              <div className="live-eyebrow">LEETLOGIC OPERATIONS</div>
              <h1>{title}</h1>
              <p>Review and manage marketplace records.</p>
            </div>
            <div className="live-actions">
              <button className="secondary" onClick={() => void load()} disabled={busy}>
                Refresh
              </button>
              {items.length > 0 && (
                <button className="secondary" onClick={exportCsv}>
                  Export this page
                </button>
              )}
              {content[resource] && can(createPermission[resource]!) && (
                <button
                  onClick={() =>
                    open(
                      `Create ${resource === "system" ? "incident" : resource === "faq" ? "FAQ" : resource === "support" ? "ticket" : resource === "translations" ? "translation" : resource === "orders" ? "order" : resource === "logistics" ? "shipment" : resource === "withdrawals" ? "withdrawal" : resource === "risk" ? "risk alert" : "compliance review"}`,
                      resource,
                      content[resource]!,
                      { stepUp: resource === "withdrawals" },
                    )
                  }
                >
                  + Create
                </button>
              )}
              {resource === "roles" && can("admin.manage") && (
                <button
                  onClick={() =>
                    open(
                      "Invite staff",
                      "invitations",
                      [email, text("fullName", "Full name"), select("roleCode", "Role", roleCodes)],
                      { stepUp: true },
                    )
                  }
                >
                  + Invite staff
                </button>
              )}
            </div>
          </div>
          {error && !action && (
            <div className="live-error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="live-notice" role="status">
              {notice}
              <button aria-label="Dismiss" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {busy && !action && <p role="status">Loading marketplace records…</p>}
          {resource === "dashboard" && (
            <div className="live-metrics">
              {["users", "listings", "orders", "verifications", "tickets"].map((key) => (
                <section key={key} className="live-card">
                  <p>
                    {key === "verifications"
                      ? "Awaiting verification"
                      : key === "tickets"
                        ? "Open tickets"
                        : key}
                  </p>
                  <strong>{data[key] ?? "—"}</strong>
                </section>
              ))}
              <section className="live-card">
                <p>Escrow held</p>
                <strong>{money(data.escrow?.heldMinor)}</strong>
              </section>
            </div>
          )}
          {resource === "reports" &&
            Object.entries(data).map(
              ([key, group]) =>
                Array.isArray(group) && (
                  <section className="live-card" key={key}>
                    <h2>{key}</h2>
                    {group.length ? (
                      group.map((row: Row, index: number) => (
                        <div className="live-report-row" key={index}>
                          <strong>{row.status || row.kind}</strong>
                          <span>{row._count} records</span>
                          {Object.entries(row._sum || {}).map(([key, value]) => (
                            <span key={key}>
                              {key.replace("Minor", "")}: {money(value)}
                            </span>
                          ))}
                        </div>
                      ))
                    ) : (
                      <p>No records yet.</p>
                    )}
                  </section>
                ),
            )}
          {resource === "settings" && data.version && (
            <section className="live-card">
              <form
                key={settingsRevision}
                onSubmit={(event) => {
                  event.preventDefault();
                  const fields: Field[] = [
                    "platformFeeBasisPoints",
                    "exportFeeBasisPoints",
                    "escrowHoldHours",
                    "disputeGraceHours",
                  ].map((name) => ({ name, label: name, type: "number" }));
                  fields.push(text("supportPhone", "Support phone"), emailForSupport);
                  const body = values(event.currentTarget, fields);
                  open("Save marketplace settings", "settings", [], {
                    method: "PUT",
                    stepUp: true,
                    extra: { ...body, version: data.version },
                  });
                }}
              >
                <div className="live-form-grid">
                  <Fields
                    fields={[
                      {
                        name: "platformFeeBasisPoints",
                        label: "Platform fee (basis points; 100 = 1%)",
                        type: "number",
                      },
                      {
                        name: "exportFeeBasisPoints",
                        label: "Export fee (basis points)",
                        type: "number",
                      },
                      { name: "escrowHoldHours", label: "Escrow hold (hours)", type: "number" },
                      {
                        name: "disputeGraceHours",
                        label: "Dispute grace period (hours)",
                        type: "number",
                      },
                      { name: "supportPhone", label: "Support phone", type: "optional" },
                      emailForSupport,
                    ]}
                    values={data}
                  />
                </div>
                <div className="live-actions">
                  <button>Save settings</button>
                  <button type="button" className="secondary" onClick={() => void load()}>
                    Reload saved settings
                  </button>
                </div>
              </form>
            </section>
          )}
          {resource === "categories" && can("catalog.manage") && Array.isArray(data.items) && (
            <Categories items={data.items || []} request={api} reload={load} />
          )}
          {!["dashboard", "reports", "settings", "categories"].includes(resource) && (
            <section className="live-card">
              {resource === "listings" && (
                <div className="listing-queue-heading">
                  <div>
                    <h2>Produce listings</h2>
                    <p>Review produce photos, stock and farmer details before publishing.</p>
                  </div>
                  <span>{data.total ?? 0} matching listings</span>
                </div>
              )}
              <form
                className="live-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  setPage(1);
                  setQuery(search);
                }}
              >
                <input
                  aria-label={resource === "listings" ? "Search produce titles" : "Search records"}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={
                    resource === "listings" ? "Search produce titles…" : "Search records…"
                  }
                />
                {statuses[resource] && (
                  <select
                    aria-label="Filter by status"
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="ALL">All statuses</option>
                    {statuses[resource]!.map((value) => (
                      <option key={value} value={value}>
                        {["verification", "listings"].includes(resource)
                          ? verificationLabel(value)
                          : value}
                      </option>
                    ))}
                  </select>
                )}
                <button className="secondary">Search</button>
              </form>
              {resource === "listings" ? (
                <ListingQueue
                  items={items}
                  busy={busy}
                  selectedId={selected?.id}
                  onReview={(row) => void review(row)}
                />
              ) : (
                <div className="live-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{resource === "verification" ? "Farm / applicant" : "Record"}</th>
                        <th>
                          {resource === "verification" ? "Application status" : "Status / action"}
                        </th>
                        <th>{resource === "verification" ? "Farm details" : "Details"}</th>
                        <th>{resource === "verification" ? "Submitted" : "Created"}</th>
                        <th>Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{rowLabel(row)}</strong>
                            <small>
                              {resource === "verification"
                                ? [
                                    row.farmerProfile?.user?.profile?.fullName ||
                                      row.farmerProfile?.user?.profile?.displayName,
                                    row.farmerProfile?.user?.phoneE164,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "Applicant details not provided"
                                : row.email || row.phoneE164 || row.id}
                            </small>
                          </td>
                          <td>
                            <span className="live-badge">
                              {(resource === "verification"
                                ? verificationLabel(row.status)
                                : row.status) ||
                                row.action ||
                                (row.balanced === undefined
                                  ? "—"
                                  : row.balanced
                                    ? "Balanced"
                                    : "Mismatch")}
                            </span>
                          </td>
                          <td>
                            {resource === "verification" ? (
                              <>
                                {row.farmerProfile?.farmType || "Farmer type not provided"}
                                <small>
                                  {row._count?.documents || 0} documents ·{" "}
                                  {row._count?.evidence || 0} evidence entries
                                </small>
                              </>
                            ) : row.totalMinor ? (
                              money(row.totalMinor)
                            ) : row.amountMinor ? (
                              money(row.amountMinor)
                            ) : (
                              row.locale ||
                              row.priority ||
                              row.severity ||
                              row.roleCode ||
                              row.farmerProfile?.user?.profile?.fullName ||
                              "—"
                            )}
                          </td>
                          <td>
                            {resource === "verification"
                              ? row.submittedAt
                                ? new Date(row.submittedAt).toLocaleString()
                                : "Not submitted"
                              : row.createdAt
                                ? new Date(row.createdAt).toLocaleString()
                                : "—"}
                          </td>
                          <td>
                            <button className="secondary" onClick={() => void review(row)}>
                              Review →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!busy && !items.length && (
                <div className="live-empty">
                  <h2>{query ? "No matching records" : "No records yet"}</h2>
                  <p>
                    {query
                      ? "Try another search."
                      : "Records will appear here when they are created in the marketplace."}
                  </p>
                </div>
              )}
              <div className="live-pagination">
                <span>
                  {data.total ?? items.length} records · Page {page}
                </span>
                <button
                  className="secondary"
                  disabled={page <= 1 || busy}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="secondary"
                  disabled={busy || !data.total || page * 25 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </section>
          )}
          {selected && (
            <section className="live-card live-detail" ref={reviewPanel} tabIndex={-1}>
              <div className="live-page-heading">
                <div>
                  <h2>{rowLabel(selected)}</h2>
                  {resource === "verification" && (
                    <p>Review the applicant, farm details and supporting evidence.</p>
                  )}
                  {resource === "listings" && (
                    <p>Review the produce, photos and farmer details before making a decision.</p>
                  )}
                </div>
                <button className="secondary" onClick={() => setSelected(undefined)}>
                  Close review
                </button>
              </div>
              {resource === "verification" ? (
                <VerificationReview
                  record={selected}
                  busy={busy}
                  canDecide={!!can("verification.decide")}
                  reviewerName={staff?.fullName}
                  onRefresh={() => review(selected)}
                  onDecision={(decision) =>
                    open(
                      `${decision === "approve" ? "Approve" : "Reject"} verification`,
                      `verifications/${selected.id}/${decision}`,
                      [reason],
                    )
                  }
                />
              ) : resource === "listings" ? (
                <ListingReview
                  key={selected.id}
                  record={selected}
                  busy={busy}
                  canDecide={!!can("catalog.manage")}
                  onStatus={(status) =>
                    open(
                      `${status === "ACTIVE" ? "Approve" : status === "REJECTED" ? "Reject" : status === "PAUSED" ? "Pause" : "Archive"} listing`,
                      `listings/${selected.id}/status`,
                      [reason],
                      { extra: { status } },
                    )
                  }
                />
              ) : (
                <dl>
                  {Object.entries(selected)
                    .filter(([, value]) => value !== null && typeof value !== "object")
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                </dl>
              )}
              {!["verification", "listings"].includes(resource) && selected.farmerProfile && (
                <div className="live-record-context">
                  <h3>{selected.farmerProfile.farmName}</h3>
                  <p>
                    {selected.farmerProfile.user?.profile?.fullName} ·{" "}
                    {selected.farmerProfile.user?.phoneE164}
                  </p>
                  <p>
                    {selected.farmerProfile.primaryAddress?.state}{" "}
                    {selected.farmerProfile.primaryAddress?.city}
                  </p>
                </div>
              )}
              {selected.roles && (
                <p>
                  Assigned roles:{" "}
                  {selected.roles.map((assignment: Row) => assignment.role?.name).join(", ")}
                </p>
              )}
              {resource !== "verification" &&
                selected.reviews?.map((review: Row) => (
                  <article key={review.id}>
                    <strong>{review.decision}</strong>
                    <p>{review.reason}</p>
                    {review.internalNotes && <p>Internal note: {review.internalNotes}</p>}
                  </article>
                ))}
              {resource !== "verification" &&
                selected.evidence?.map((evidence: Row) => (
                  <div key={evidence.id}>
                    {evidence.note && <p>Farm evidence: {evidence.note}</p>}
                    {evidence.readUrl && (
                      <a href={evidence.readUrl} target="_blank" rel="noreferrer">
                        Open private farm evidence
                      </a>
                    )}
                  </div>
                ))}
              {resource === "audit" && (
                <pre className="live-audit-change">
                  {JSON.stringify(
                    { before: selected.beforeRedacted, after: selected.afterRedacted },
                    null,
                    2,
                  )}
                </pre>
              )}
              {resource !== "verification" &&
                selected.documents?.map((document: Row) => (
                  <p key={document.id}>
                    <a href={document.readUrl} target="_blank" rel="noreferrer">
                      Open {document.documentType || "verification document"} (link expires in 5
                      minutes)
                    </a>
                  </p>
                ))}
              {selected.messages && (
                <div className="live-messages">
                  <h3>Conversation</h3>
                  {selected.messages.length ? (
                    selected.messages.map((message: Row) => (
                      <article key={message.id}>
                        <small>
                          {message.internal ? "Internal note" : "Staff reply"} ·{" "}
                          {new Date(message.createdAt).toLocaleString()}
                        </small>
                        <p>{message.body}</p>
                      </article>
                    ))
                  ) : (
                    <p>No messages yet.</p>
                  )}
                </div>
              )}
              <div className="live-actions">
                {resource === "users" && can("users.manage") && (
                  <button
                    onClick={() =>
                      open(
                        "Update user status",
                        `users/${selected.id}/status`,
                        [select("status", "Status", ["ACTIVE", "SUSPENDED", "CLOSED"]), reason],
                        { values: selected },
                      )
                    }
                  >
                    Change account status
                  </button>
                )}
                {resource === "orders" &&
                  selected.status === "AWAITING_PAYMENT" &&
                  can("orders.manage") && (
                    <button
                      onClick={() =>
                        open("Cancel unpaid order", `orders/${selected.id}/cancel`, [reason])
                      }
                    >
                      Cancel order
                    </button>
                  )}
                {resource === "orders" &&
                  selected.fundsProvider !== "bachs" &&
                  can("payments.manage") && (
                    <button
                      onClick={() =>
                        open(
                          "Record escrow transaction",
                          `orders/${selected.id}/escrow`,
                          [
                            select("kind", "Action", ["FUND", "RELEASE", "REFUND"]),
                            text("amountMinor", "Amount in kobo"),
                            {
                              name: "externalRef",
                              label: "Verified payment reference (required for funding)",
                              type: "optional",
                            },
                            reason,
                          ],
                          { stepUp: true, extra: { mutationKey: crypto.randomUUID() } },
                        )
                      }
                    >
                      Manage escrow
                    </button>
                  )}
                {resource === "orders" &&
                  selected?.fundsProvider === "bachs" &&
                  can("payments.read") && (
                    <MoneyOperations orderId={selected.id} manage={can("payments.manage")} />
                  )}
                {resource === "orders" && selected?.id && (
                  <CustomerDelivery
                    id={selected.id}
                    staff
                    staffPermissions={staff?.permissions || []}
                  />
                )}
                {resource === "logistics" && can("orders.manage") && (
                  <button
                    onClick={() =>
                      open("Update shipment", `logistics/${selected.id}/status`, [
                        select("status", "Status", ["IN_TRANSIT", "DELIVERED"]),
                        text("evidence", "Delivery / tracking evidence"),
                      ])
                    }
                  >
                    Update shipment
                  </button>
                )}
                {resource === "withdrawals" &&
                  can("payments.manage") &&
                  selected.status === "REQUESTED" && (
                    <button
                      onClick={() =>
                        open(
                          "Review withdrawal",
                          `withdrawals/${selected.id}/status`,
                          [select("status", "Decision", ["AUTHORIZED", "REJECTED"]), reason],
                          { stepUp: true },
                        )
                      }
                    >
                      Authorize / reject
                    </button>
                  )}
                {["support", "disputes"].includes(resource) && can("support.manage") && (
                  <>
                    <button
                      onClick={() =>
                        open("Add reply", `support/${selected.id}/message`, [
                          { name: "body", label: "Message", type: "textarea" },
                          { name: "internal", label: "Internal note", type: "checkbox" },
                        ])
                      }
                    >
                      Reply / add note
                    </button>
                    <button
                      onClick={() =>
                        open(
                          "Update ticket",
                          `support/${selected.id}/status`,
                          [select("status", "Status", ["OPEN", "IN_PROGRESS", "RESOLVED"]), reason],
                          { values: selected },
                        )
                      }
                    >
                      Assign to me / resolve
                    </button>
                  </>
                )}
                {["risk", "compliance"].includes(resource) && (
                  <button
                    onClick={() =>
                      open("Review record", `${resource}/${selected.id}/status`, [
                        select(
                          "status",
                          "Decision",
                          resource === "risk"
                            ? ["RESOLVED", "DISMISSED", "OPEN"]
                            : ["APPROVED", "REJECTED"],
                        ),
                        reason,
                      ])
                    }
                  >
                    Review decision
                  </button>
                )}
                {["faq", "translations", "system"].includes(resource) && (
                  <button
                    onClick={() =>
                      open("Update record", `${resource}/${selected.id}`, content[resource]!, {
                        method: "PUT",
                        values: selected,
                      })
                    }
                  >
                    Edit / publish
                  </button>
                )}
                {resource === "roles" && selected.status === "INVITED" && can("admin.manage") && (
                  <button
                    onClick={() =>
                      open("Resend invitation", `invitations/${selected.id}/resend`, [], {
                        stepUp: true,
                      })
                    }
                  >
                    Resend invitation
                  </button>
                )}
                {resource === "roles" && can("admin.manage") && (
                  <button
                    onClick={() =>
                      open(
                        "Update staff access",
                        `roles/${selected.id}`,
                        [
                          select("roleCode", "Role", roleCodes),
                          select("status", "Status", ["ACTIVE", "SUSPENDED"]),
                        ],
                        { stepUp: true },
                      )
                    }
                  >
                    Change role / suspend
                  </button>
                )}
              </div>
              {resource === "withdrawals" && (
                <p className="live-muted">
                  Authorization reserves funds for payout. Bank transfer execution requires a
                  configured payout provider.
                </p>
              )}
              {resource === "orders" && (
                <p className="live-muted">
                  Funding records a verified payment reference. Refunds and releases update the
                  internal ledger; external transfers require the payment provider.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
      <dialog ref={dialog} className="live-dialog" onCancel={() => setAction(undefined)}>
        {action && (
          <form onSubmit={submit}>
            <h2>{action.label}</h2>
            <Fields fields={action.fields} values={action.values} />
            {action.stepUp && (
              <label>
                Authenticator code
                <input
                  name="stepUpCode"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </label>
            )}
            {error && (
              <p role="alert" className="live-error">
                {error}
              </p>
            )}
            <div className="live-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setAction(undefined)}
              >
                Cancel
              </button>
              <button disabled={busy}>{busy ? "Saving…" : "Confirm"}</button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
const emailForSupport: Field = { name: "supportEmail", label: "Support email", type: "email" };
function money(value: unknown) {
  return value === null || value === undefined ? "₦0.00" : formatMinor(value);
}

const statuses: Record<string, string[]> = {
  users: ["ACTIVE", "SUSPENDED", "CLOSED"],
  verification: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "RESUBMISSION_REQUIRED"],
  listings: ["PENDING_REVIEW", "ACTIVE", "PAUSED", "SOLD_OUT", "REJECTED", "ARCHIVED", "DRAFT"],
  orders: ["AWAITING_PAYMENT", "FUNDED", "DELIVERED", "COMPLETED", "REFUNDED", "CANCELLED"],
  logistics: ["ASSIGNED", "IN_TRANSIT", "DELIVERED"],
  withdrawals: ["REQUESTED", "AUTHORIZED", "REJECTED"],
  support: ["OPEN", "IN_PROGRESS", "RESOLVED"],
  disputes: ["OPEN", "IN_PROGRESS", "RESOLVED"],
  faq: ["DRAFT", "PUBLISHED"],
  translations: ["DRAFT", "PUBLISHED"],
  risk: ["OPEN", "RESOLVED", "DISMISSED"],
  compliance: ["PENDING_REVIEW", "APPROVED", "REJECTED"],
  system: ["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"],
};

function formatMinor(value: unknown) {
  const amount = BigInt(String(value));
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "−" : ""}₦${new Intl.NumberFormat("en-NG").format(absolute / 100n)}.${String(absolute % 100n).padStart(2, "0")}`;
}
