"use client";
import { useRef, useState, type FormEvent } from "react";
type Category = {
  id: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  translations: { locale: string; name: string }[];
  _count?: { listings: number };
};
const languages = [
  ["en", "English"],
  ["pcm", "Nigerian Pidgin"],
  ["ha", "Hausa"],
  ["ig", "Igbo"],
  ["yo", "Yoruba"],
] as const;
const empty = () => ({
  slug: "",
  isActive: true,
  sortOrder: 0,
  names: Object.fromEntries(languages.map(([locale]) => [locale, ""])),
});
export function Categories({
  items,
  request,
  reload,
}: {
  items: Category[];
  request: (path: string, method: string, body: Record<string, unknown>) => Promise<unknown>;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const edit = (item?: Category) => {
    setEditing(item?.id || null);
    setForm(
      item
        ? {
            slug: item.slug,
            isActive: item.isActive,
            sortOrder: item.sortOrder,
            names: Object.fromEntries(
              languages.map(([locale]) => [
                locale,
                item.translations.find((t) => t.locale === locale)?.name || "",
              ]),
            ),
          }
        : empty(),
    );
    setError("");
    setNotice("");
    panel.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    panel.current?.focus({ preventScroll: true });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(editing ? `categories/${editing}` : "categories", editing ? "PATCH" : "POST", {
        slug: form.slug.trim(),
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder),
        translations: languages
          .filter(([locale]) => form.names[locale]?.trim())
          .map(([locale]) => ({ locale, name: form.names[locale]!.trim() })),
      });
      await reload();
      setEditing(null);
      setForm(empty());
      setNotice("Category saved. Changes are available when the marketplace refreshes.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="category-manager">
      <section className="live-card" ref={panel} tabIndex={-1} aria-label="Category editor">
        <h2>{editing ? "Edit category" : "Add category"}</h2>
        <p>
          Categories organise produce for buyers and farmers. Inactive categories cannot be selected
          for new listings; existing listings and orders are preserved.
        </p>
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <form onSubmit={save}>
          <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="category-fields">
              <label>
                Category slug
                <input
                  required
                  value={form.slug}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={100}
                  placeholder="fruits-and-vegetables"
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </label>
              <label>
                Display order
                <input
                  required
                  type="number"
                  min={0}
                  max={10000}
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                />
              </label>
              {languages.map(([locale, name]) => (
                <label key={locale}>
                  {name}
                  {locale === "en" ? " (required)" : " (optional)"}
                  <input
                    required={locale === "en"}
                    maxLength={120}
                    value={form.names[locale]}
                    onChange={(e) =>
                      setForm({ ...form, names: { ...form.names, [locale]: e.target.value } })
                    }
                  />
                </label>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0" }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active — available to farmers and buyers
            </label>
            <div className="live-actions">
              <button type="submit" aria-busy={busy}>
                {busy ? "Saving…" : editing ? "Save changes" : "Add category"}
              </button>
              {editing && (
                <button type="button" className="secondary" onClick={() => edit()}>
                  Cancel editing
                </button>
              )}
            </div>
          </fieldset>
        </form>
      </section>
      <section className="live-card">
        <h2>Listing categories</h2>
        <p>Lower display orders appear first. Missing translations fall back to English.</p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Status</th>
                <th>Order</th>
                <th>Listings</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {item.translations.find((t) => t.locale === "en")?.name || item.slug}
                    </strong>
                    <br />
                    <small>{item.slug}</small>
                  </td>
                  <td>{item.isActive ? "Active" : "Inactive"}</td>
                  <td>{item.sortOrder}</td>
                  <td>{item._count?.listings ?? 0}</td>
                  <td>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => edit(item)}
                      aria-label={`Edit ${item.slug}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && <p>No categories yet. Add the first category above.</p>}
      </section>
    </div>
  );
}
