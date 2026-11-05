"use client";
import { useEffect, useRef, useState } from "react";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError } from "../../mobile/src/lib/localization";
export function CustomerOrderIssues({
  orderId,
  autoOpen = false,
  onChanged,
}: {
  orderId: string;
  autoOpen?: boolean;
  onChanged: () => Promise<void>;
}) {
  const { locale } = useLanguage(),
    say = (s: string) => ui(locale, s);
  const [data, setData] = useState<any>(),
    [open, setOpen] = useState(false),
    [reason, setReason] = useState("NOT_RECEIVED"),
    [description, setDescription] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const running = useRef(false);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);
  useEffect(() => {
    let active = true;
    void customerApi(`orders/${orderId}/disputes`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(localizedError(locale, e));
      });
    return () => {
      active = false;
    };
  }, [orderId, locale]);
  const active = data?.items?.some((item: any) => item.status !== "RESOLVED");
  return (
    <section className="order-confirmation">
      <h3>{say("Order issues")}</h3>
      {error && <p role="alert">{error}</p>}
      {data?.items?.map((item: any) => (
        <article key={item.id}>
          <strong>{item.subject}</strong>
          <p>{say(item.status)}</p>
          {item.messages?.map((message: any) => (
            <p key={message.id}>{message.body}</p>
          ))}
        </article>
      ))}
      {data?.canOpen &&
        !active &&
        (!open ? (
          <button onClick={() => setOpen(true)}>{say("Report an issue")}</button>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (running.current) return;
              running.current = true;
              setBusy(true);
              setError("");
              try {
                await customerApi(`orders/${orderId}/disputes`, {
                  reason,
                  description: description.trim(),
                  sourceLocale: locale,
                });
                setOpen(false);
                setDescription("");
                setData(await customerApi(`orders/${orderId}/disputes`));
                await onChanged();
              } catch (e) {
                setError(localizedError(locale, e));
              } finally {
                running.current = false;
                setBusy(false);
              }
            }}
          >
            <label>
              {say("Reason")}
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                {[
                  ["NOT_RECEIVED", "Order not received"],
                  ["QUALITY", "Produce quality"],
                  ["WRONG_ITEM", "Wrong produce"],
                  ["QUANTITY", "Incorrect quantity"],
                  ["OTHER", "Other issue"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {say(label!)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {say("Describe the issue")}
              <textarea
                required
                minLength={10}
                maxLength={5000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <button disabled={busy || description.trim().length < 10}>{say("Submit issue")}</button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)}>
              {say("Cancel")}
            </button>
          </form>
        ))}
    </section>
  );
}
