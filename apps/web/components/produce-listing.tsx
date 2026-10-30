"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { SalePackagingFields } from "./sale-packaging-fields";
import { formatMoney } from "../../../packages/contracts/src/money";
import {
  salePackagingSchema,
  salePackagingMatches,
  packagingOptions,
  minimumPackedWeight,
  saleUnitLabel,
  type SalePackaging,
} from "../../../packages/contracts/src/sale-packaging";
import { packagingSchema } from "../../../packages/contracts/src/packaging";
import { ui } from "../../mobile/src/lib/localization";

export function ProduceListing() {
  const { t, locale } = useLanguage();
  const say = (text: string, params = {}) => ui(locale, text, params);
  const [catalogue, setCatalogue] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [draftId, setDraftId] = useState("");
  const [formRevision, setFormRevision] = useState(0);
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [salePackaging, setSalePackaging] = useState<SalePackaging>();
  const [unitCode, setUnitCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [assistance, setAssistance] = useState(false);
  const [packingRevision, setPackingRevision] = useState(0);
  const category = catalogue?.categories.find((item: any) => item.id === categoryId);
  const resetPackaging = () => {
    setSalePackaging(undefined);
    setUnitCode("");
    setPrice("");
    setQuantity("");
    setAssistance(false);
    setPackingRevision((value) => value + 1);
  };
  useEffect(() => {
    customerApi("listing-drafts/catalogue")
      .then(setCatalogue)
      .catch((e) => setNotice(e.message));
  }, []);
  useEffect(() => {
    if (
      salePackaging &&
      !packagingOptions(category?.slug || "", title).some(
        (option) => option.value === salePackaging.type,
      )
    )
      resetPackaging();
  }, [category?.slug, title, salePackaging?.type]);
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
  async function advance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice("");
    const form = e.currentTarget;
    const active = form.querySelector(`[data-step="${step}"]`);
    for (const field of active?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea") || []) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return;
      }
    }
    try {
      if (step === 4) {
        salePackagingSchema.parse(salePackaging);
        if (!salePackagingMatches(salePackaging!, category?.slug || "", title, unitCode))
          throw new Error(say("Choose a packaging type and enter a valid package size."));
        if (!/^\d{1,10}(\.\d{1,2})?$/.test(price) || Number(price) <= 0)
          throw new Error(say("Enter a price in naira with at most two decimal places."));
        if (!/^\d{1,9}(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0)
          throw new Error(say("Enter a positive quantity with at most three decimal places."));
        if (
          !catalogue.units.find((item: any) => item.code === unitCode)?.allowsDecimal &&
          !/^\d+$/.test(quantity)
        )
          throw new Error(say("Enter a whole quantity for this selling unit."));
        if (!assistance) packingValue(new FormData(form));
      }
      if (step < 5) {
        setStep(step + 1);
        return;
      }
      if (!photo) throw new Error(say("Add at least one photo of your produce before submitting."));
      setBusy(true);
      const f = new FormData(form);
      const [whole, decimal = ""] = price.split(".");
      const unitPriceMinor = (BigInt(whole!) * 100n + BigInt(decimal.padEnd(2, "0"))).toString();
      const fields = {
        title,
        description: f.get("description"),
        quantity,
        unitCode,
        categoryId,
        addressId: f.get("addressId"),
        sourceLocale: locale,
        unitPriceMinor,
        salePackaging: salePackagingSchema.parse(salePackaging),
        shippingScope: f.get("shippingScope"),
        packingAssistanceRequested: assistance,
        ...(!assistance ? { packaging: packingValue(f) } : {}),
        photoId: photo.id,
      };
      const result = await customerApi(
        draftId ? `listing-drafts/${draftId}` : "listing-drafts",
        fields,
        draftId ? "PATCH" : "POST",
      );
      setDraftId(result.id);
      setDraft({ id: result.id, fields });
      setConfirmed(false);
      setStep(6);
    } catch (e) {
      setNotice(
        e instanceof Error && e.name === "ZodError"
          ? say("Choose a packaging type and enter a valid package size.")
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  function packingValue(f: FormData) {
    const packing = packagingSchema.parse({
      unitsPerPackage: Number(f.get("unitsPerPackage")),
      weightKg: Number(f.get("weightKg")),
      length: Number(f.get("length")),
      width: Number(f.get("width")),
      height: Number(f.get("height")),
      handling: f.get("handling"),
      notes: String(f.get("notes") || ""),
    });
    if (
      !catalogue.units.find((item: any) => item.code === unitCode)?.allowsDecimal &&
      !Number.isInteger(packing.unitsPerPackage)
    )
      throw new Error(say("Enter whole selling units in each package."));
    if (
      packing.weightKg <
      Math.max(
        unitCode === "KG" ? packing.unitsPerPackage : 0,
        minimumPackedWeight(salePackaging, packing.unitsPerPackage),
      )
    )
      throw new Error(say("Packed weight must include the produce weight and its packaging."));
    return packing;
  }
  async function submit() {
    setBusy(true);
    try {
      await customerApi(`listing-drafts/${draft.id}/submit`, { confirmed });
      setNotice(t("sell.submitted"));
      setDraft(null);
      setPhoto(null);
      setStep(1);
      setTitle("");
      setCategoryId("");
      resetPackaging();
      setDraftId("");
      setFormRevision((value) => value + 1);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="customer-panel">
      <h1>{t("sell.title")}</h1>
      <p aria-live="polite">{say("Step {step} of 6", { step })}</p>
      <progress value={step} max={6} aria-label={say("Listing progress")} />
      {!catalogue ? (
        <Link href="/account">{t("auth.required")}</Link>
      ) : (
        <>
          {catalogue.verificationStatus !== "APPROVED" && <p>{t("sell.verified")}</p>}
          <form key={formRevision} onSubmit={advance} noValidate hidden={!!draft}>
            <fieldset data-step="1" hidden={step !== 1}>
              <legend>{say("Choose Voice or Type")}</legend>
              <p>{t("sell.voiceBlocked")}</p>
              <button type="submit" disabled={busy}>
                {say("Type my listing")}
              </button>
            </fieldset>
            <fieldset data-step="2" hidden={step !== 2}>
              <legend>{say("Choose a category")}</legend>
              <label>
                {t("sell.category")}
                <select
                  name="categoryId"
                  required
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    resetPackaging();
                  }}
                >
                  <option value="">—</option>
                  {catalogue.categories.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.translations.find((text: any) => text.locale === locale)?.name ||
                        item.translations.find((text: any) => text.locale === "en")?.name ||
                        item.slug}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <fieldset data-step="3" hidden={step !== 3}>
              <legend>{say("Describe your produce.")}</legend>
              <label>
                {t("sell.product")}
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                {t("sell.description")}
                <textarea name="description" required maxLength={5000} />
              </label>
              <label>
                {t("sell.location")}
                <select name="addressId" required defaultValue="">
                  <option value="">—</option>
                  {catalogue.addresses.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.line1}, {item.city}, {item.state}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {say("Delivery scope *")}
                <select name="shippingScope" defaultValue="NATIONWIDE">
                  <option value="NATIONWIDE">{say("Nigeria")}</option>
                  <option value="LOCAL">{say("Local")}</option>
                </select>
              </label>
            </fieldset>
            <fieldset data-step="4" hidden={step !== 4}>
              <legend>{say("Packaging and price")}</legend>
              <SalePackagingFields
                category={category?.slug || ""}
                title={title}
                units={catalogue.units}
                value={salePackaging}
                unitCode={unitCode}
                quantity={quantity}
                price={price}
                onQuantity={setQuantity}
                onPrice={setPrice}
                onChange={(value, code) => {
                  setSalePackaging(value);
                  setUnitCode(code);
                  setQuantity("");
                  setPrice("");
                  setPackingRevision((revision) => revision + 1);
                }}
              />
              <h2>{say("Delivery measurements")}</h2>
              <p>
                {say(
                  "These measurements describe one parcel for the courier. They do not change your selling price or stock quantity.",
                )}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={assistance}
                  onChange={(e) => setAssistance(e.target.checked)}
                />
                {say("Ask our team to help with package measurements")}
              </label>
              {assistance && (
                <p>
                  {say(
                    "Your listing will wait for our team to complete package measurements. Buyers cannot purchase it until then.",
                  )}
                </p>
              )}
              <fieldset key={packingRevision} disabled={assistance} hidden={assistance}>
                <legend>{t("sell.packing")}</legend>
                {(["unitsPerPackage", "weightKg", "length", "width", "height"] as const).map(
                  (key) => (
                    <label key={key}>
                      {t(`sell.${key}`)}
                      <input
                        name={key}
                        type="number"
                        min="0.001"
                        step="0.001"
                        required
                        defaultValue={key === "unitsPerPackage" ? "1" : ""}
                      />
                    </label>
                  ),
                )}
                <label>
                  {t("sell.handling")}
                  <select name="handling">
                    {["STANDARD", "PERISHABLE", "COLD_CHAIN", "BULK"].map((code) => (
                      <option key={code} value={code}>
                        {t(`delivery.handling.${code}` as any)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("delivery.instructions")}
                  <textarea name="notes" maxLength={500} />
                </label>
              </fieldset>
            </fieldset>
            <fieldset data-step="5" hidden={step !== 5}>
              <legend>{say("Review your photos")}</legend>
              <label>
                {t("sell.photo")}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
              </label>
              {photo && <img src={photo.url} alt={t("sell.photo")} width={240} />}
            </fieldset>
            {step > 1 && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setNotice("");
                    setStep(step - 1);
                  }}
                >
                  {say("Go back")}
                </button>
                <button disabled={busy}>{step === 5 ? t("sell.review") : say("Continue")}</button>
              </>
            )}
          </form>
          {draft && (
            <div>
              <h2>{t("sell.review")}</h2>
              {photo && <img src={photo.url} alt={t("sell.photo")} width={240} />}
              <dl>
                {[
                  [t("sell.product"), draft.fields.title],
                  [t("sell.description"), draft.fields.description],
                  [
                    t("sell.quantity"),
                    `${draft.fields.quantity} × ${saleUnitLabel(draft.fields.salePackaging, say) || draft.fields.unitCode}`,
                  ],
                  [
                    t("sell.price"),
                    `${formatMoney(draft.fields.unitPriceMinor)} / ${saleUnitLabel(draft.fields.salePackaging, say) || draft.fields.unitCode}`,
                  ],
                  [t("sell.packing"), saleUnitLabel(draft.fields.salePackaging, say)],
                  [
                    t("sell.location"),
                    catalogue.addresses.find((item: any) => item.id === draft.fields.addressId)
                      ?.line1,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {draft.fields.packaging && (
                <p>
                  {draft.fields.packaging.unitsPerPackage} · {draft.fields.packaging.weightKg} kg ·{" "}
                  {draft.fields.packaging.length} × {draft.fields.packaging.width} ×{" "}
                  {draft.fields.packaging.height} cm
                </p>
              )}
              {draft.fields.packingAssistanceRequested && (
                <p>
                  {say(
                    "Packing assistance requested. Our team must complete package measurements before buyers can purchase.",
                  )}
                </p>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {t("sell.confirm")}
              </label>
              <button
                disabled={!confirmed || busy || catalogue.verificationStatus !== "APPROVED"}
                onClick={submit}
              >
                {t("sell.submit")}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  setStep(5);
                  setConfirmed(false);
                }}
              >
                {say("Go back")}
              </button>
            </div>
          )}
        </>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
