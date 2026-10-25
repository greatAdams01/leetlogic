"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
export function ProduceListing() {
  const { t, locale } = useLanguage();
  const [catalogue, setCatalogue] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    customerApi("listing-drafts/catalogue")
      .then(setCatalogue)
      .catch((e) => setNotice(e.message));
  }, []);
  async function upload(file: File) {
    setBusy(true);
    try {
      const response = await fetch("/api/customer/listing-photos", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Upload failed");
      setPhoto(result);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const f = new FormData(e.currentTarget);
      const price = String(f.get("price"));
      if (!/^\d+(\.\d{1,2})?$/.test(price))
        throw new Error("Enter a price with at most two decimal places");
      const [whole, decimal = ""] = price.split(".");
      const unitPriceMinor = (BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"))).toString();
      const result = await customerApi("listing-drafts", {
        title: f.get("title"),
        description: f.get("description"),
        quantity: f.get("quantity"),
        unitCode: f.get("unitCode"),
        categoryId: f.get("categoryId"),
        addressId: f.get("addressId"),
        sourceLocale: locale,
        unitPriceMinor,
        ...(photo ? { photoId: photo.id } : {}),
      });
      setDraft(result);
      setConfirmed(false);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    try {
      await customerApi(`listing-drafts/${draft.id}/submit`, { confirmed });
      setNotice(t("sell.submitted"));
      setDraft(null);
      setPhoto(null);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="customer-panel">
      <h1>{t("sell.title")}</h1>
      <aside>
        <h2>{t("sell.voice")}</h2>
        <p>{t("sell.voiceBlocked")}</p>
      </aside>
      {!catalogue ? (
        <Link href="/account">{t("auth.required")}</Link>
      ) : (
        <>
          {catalogue.verificationStatus !== "APPROVED" && <p>{t("sell.verified")}</p>}
          {!draft ? (
            <form onSubmit={review}>
              <label>
                {t("sell.product")}
                <input name="title" required maxLength={160} />
              </label>
              <label>
                {t("sell.description")}
                <textarea name="description" maxLength={5000} />
              </label>
              <label>
                {t("sell.category")}
                <select name="categoryId" required>
                  <option value="">—</option>
                  {catalogue.categories.map((x: any) => (
                    <option key={x.id} value={x.id}>
                      {x.translations.find((y: any) => y.locale === locale)?.name ||
                        x.translations.find((y: any) => y.locale === "en")?.name ||
                        x.slug}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("sell.quantity")}
                <input name="quantity" type="number" min="0.001" step="0.001" required />
              </label>
              <label>
                {t("sell.unit")}
                <select name="unitCode" required>
                  {catalogue.units.map((x: any) => (
                    <option key={x.code} value={x.code}>
                      {x.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("sell.price")}
                <input name="price" type="number" min="0.01" step="0.01" required />
              </label>
              <label>
                {t("sell.location")}
                <select name="addressId" required>
                  <option value="">—</option>
                  {catalogue.addresses.map((x: any) => (
                    <option key={x.id} value={x.id}>
                      {x.line1}, {x.city}, {x.state}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("sell.photo")}
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
              </label>
              {photo && <img src={photo.url} alt={t("sell.photo")} width={240} />}
              <button disabled={busy || !photo || catalogue.verificationStatus !== "APPROVED"}>
                {t("sell.review")}
              </button>
            </form>
          ) : (
            <div>
              <h2>{t("sell.review")}</h2>
              {photo && <img src={photo.url} alt={t("sell.photo")} width={240} />}
              <dl>
                {[
                  "title",
                  "description",
                  "quantity",
                  "unitCode",
                  "unitPriceMinor",
                  "addressId",
                ].map((key) => (
                  <div key={key}>
                    <dt>
                      {key === "unitPriceMinor"
                        ? t("sell.price")
                        : key === "title"
                          ? t("sell.product")
                          : key === "unitCode"
                            ? t("sell.unit")
                            : key === "addressId"
                              ? t("sell.location")
                              : t(`sell.${key}` as any)}
                    </dt>
                    <dd>
                      {key === "unitPriceMinor"
                        ? (Number(draft.fields[key]) / 100).toFixed(2)
                        : key === "addressId"
                          ? catalogue.addresses.find((x: any) => x.id === draft.fields[key])?.line1
                          : draft.fields[key]}
                    </dd>
                  </div>
                ))}
              </dl>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {t("sell.confirm")}
              </label>
              <button disabled={!confirmed || busy || !photo} onClick={submit}>
                {t("sell.submit")}
              </button>
              <button onClick={() => setDraft(null)}>{t("common.cancel")}</button>
            </div>
          )}
        </>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
