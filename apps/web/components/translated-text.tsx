"use client";
import { useEffect, useState } from "react";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
export function TranslatedText({
  resource,
  id,
  original,
}: {
  resource: "listings" | "messages";
  id: string;
  original: string;
}) {
  const { locale, t } = useLanguage();
  const [text, setText] = useState(original);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setText(original);
    setNotice("");
  }, [original, locale]);
  async function translate() {
    setBusy(true);
    try {
      const result = await customerApi(`translations/${resource}/${id}?locale=${locale}`);
      setText(result.text);
      setNotice(result.reason ? t("common.unavailable") : "");
    } catch {
      setNotice(t("common.unavailable"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p>{text}</p>
      <button disabled={busy} onClick={translate}>
        {busy ? t("common.loading") : t("common.translate")}
      </button>
      {text !== original && (
        <button onClick={() => setText(original)}>{t("common.original")}</button>
      )}
      <p role="status">{notice}</p>
    </div>
  );
}
