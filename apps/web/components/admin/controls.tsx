"use client";

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { usePathname } from "next/navigation";

export const AdminFilterContext = createContext({
  filter: "All",
  setFilter: (_value: string) => {},
});

export function AdminDraftStatus(props: HTMLAttributes<HTMLParagraphElement>) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const change = (event: Event) => {
      if (event.target instanceof HTMLInputElement && event.target.type !== "search")
        setDirty(true);
    };
    const saved = () => setDirty(false);
    document.addEventListener("input", change);
    document.addEventListener("admin-draft-saved", saved);
    document.addEventListener("admin-reset-defaults", saved);
    return () => {
      document.removeEventListener("input", change);
      document.removeEventListener("admin-draft-saved", saved);
      document.removeEventListener("admin-reset-defaults", saved);
    };
  }, []);
  return (
    <p {...props} role="status">
      {dirty ? "Unsaved changes in this demo draft" : "All demo values saved"}
    </p>
  );
}

export function controlText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement<{ children?: ReactNode }>(child)) return controlText(child.props.children);
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Native controls retain the configured Figma slots and their scoped styles. */
export function AdminControl({
  children,
  initialChecked = true,
  onImageSrc,
  offImageSrc,
  ...props
}: HTMLAttributes<HTMLButtonElement> & {
  "data-name"?: string;
  initialChecked?: boolean;
  onImageSrc?: string;
  offImageSrc?: string;
}) {
  const name = props["data-name"] || "";
  const toggle = /Toggle state|Check state/.test(name);
  const filters = useContext(AdminFilterContext);
  const chip = name === "Filter chip";
  const label = controlText(children).replace(/\s+\d+$/, "");
  const filterLabel = label.startsWith("All") ? "All" : label;
  const [checked, setChecked] = useState(initialChecked);
  return (
    <button
      {...props}
      type="button"
      aria-label={
        props["aria-label"] || controlText(children) || (toggle ? "Toggle setting" : name)
      }
      role={toggle ? "switch" : undefined}
      aria-checked={toggle ? checked : undefined}
      aria-pressed={chip ? filters.filter === filterLabel : undefined}
      onClick={
        toggle
          ? () => setChecked(!checked)
          : chip
            ? () => filters.setFilter(filterLabel)
            : undefined
      }
      data-admin-control="true"
    >
      {name === "Toggle state" && onImageSrc && offImageSrc ? (
        <img src={checked ? onImageSrc : offImageSrc} alt="" />
      ) : (
        children
      )}
    </button>
  );
}

export function AdminField({
  label,
  initialValue = "",
  search = false,
  select = false,
  className,
  ...props
}: HTMLAttributes<HTMLInputElement> & {
  label: string;
  initialValue?: string;
  search?: boolean;
  select?: boolean;
  "data-name"?: string;
}) {
  const digit = props["data-name"] === "Code digit";
  const password = /password/i.test(label);
  const pathname = usePathname();
  const [value, setValue] = useState(password || digit ? "" : initialValue.replace(/\s{2,}/g, " "));
  useEffect(() => {
    const reset = () => setValue(password || digit ? "" : initialValue.replace(/\s{2,}/g, " "));
    document.addEventListener("admin-reset-defaults", reset);
    return () => document.removeEventListener("admin-reset-defaults", reset);
  }, [initialValue, password, digit]);
  useEffect(() => {
    const clear = () => {
      if (search) setValue("");
    };
    document.addEventListener("admin-clear-search", clear);
    return () => document.removeEventListener("admin-clear-search", clear);
  }, [search]);
  useEffect(() => {
    if (search || password || digit || /email/i.test(label)) return;
    try {
      const saved: [string, string][] = JSON.parse(
        localStorage.getItem(
          `leetlogic-admin-demo-${pathname.replace(/^\/admin\/?/, "") || "dashboard"}`,
        ) || "[]",
      );
      const entry = saved.find(([name]) => name === label);
      if (entry) setValue(entry[1]);
    } catch {
      /* Missing or malformed local demo drafts use the design values. */
    }
  }, [pathname, label, search, password, digit]);
  if (select)
    return (
      <select
        className={`${className || ""} admin-field`}
        aria-label={label}
        defaultValue={initialValue}
      >
        {[initialValue, "All", "Pending", "Under review", "Approved", "Resolved"]
          .filter((v, i, arr) => v && arr.indexOf(v) === i)
          .map((v) => (
            <option key={v}>{v}</option>
          ))}
      </select>
    );
  return (
    <input
      {...props}
      className={`${className || ""} admin-field ${search ? "admin-search" : ""}`}
      aria-label={label}
      name={label}
      placeholder={search ? label : undefined}
      type={search ? "search" : password ? "password" : "text"}
      autoComplete={
        password
          ? "current-password"
          : /email/i.test(label)
            ? "username"
            : digit
              ? "one-time-code"
              : "off"
      }
      inputMode={digit ? "numeric" : undefined}
      maxLength={digit ? 1 : undefined}
      value={value}
      onChange={(event) => {
        setValue(digit ? event.target.value.replace(/\D/g, "") : event.target.value);
        if (search)
          event.currentTarget.dispatchEvent(
            new CustomEvent("admin-search", { bubbles: true, detail: event.target.value }),
          );
        if (digit && event.target.value) {
          const fields = Array.from(
            event.currentTarget
              .closest('[data-name="Code entry"]')
              ?.querySelectorAll<HTMLInputElement>("input") || [],
          );
          fields[fields.indexOf(event.currentTarget) + 1]?.focus();
        }
      }}
      onPaste={
        digit
          ? (event) => {
              const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              if (digits.length < 2) return;
              event.preventDefault();
              const fields = event.currentTarget
                .closest('[data-name="Code entry"]')
                ?.querySelectorAll<HTMLInputElement>("input");
              fields?.forEach((field, index) => {
                const setter = Object.getOwnPropertyDescriptor(
                  HTMLInputElement.prototype,
                  "value",
                )?.set;
                setter?.call(field, digits[index] || "");
                field.dispatchEvent(new Event("input", { bubbles: true }));
              });
            }
          : undefined
      }
    />
  );
}
