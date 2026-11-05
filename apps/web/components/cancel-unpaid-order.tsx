"use client";
import { useRef, useState } from "react";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError } from "../../mobile/src/lib/localization";
export function CancelUnpaidOrder({
  orderId,
  onChanged,
}: {
  orderId: string;
  onChanged: () => Promise<unknown>;
}) {
  const { locale } = useLanguage(),
    say = (s: string) => ui(locale, s);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const running = useRef(false);
  return (
    <section>
      {!open ? (
        <button className="secondary" onClick={() => setOpen(true)}>
          {say("Cancel unpaid order")}
        </button>
      ) : (
        <>
          <p>
            {say(
              "The reserved produce will become available again. No payment or refund is processed.",
            )}
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              if (running.current) return;
              running.current = true;
              setBusy(true);
              setError("");
              try {
                await customerApi(`marketplace/orders/${orderId}/cancel`, {});
                await onChanged();
              } catch (e) {
                setError(localizedError(locale, e));
              } finally {
                running.current = false;
                setBusy(false);
              }
            }}
          >
            {say("Cancel order")}
          </button>
          <button className="secondary" disabled={busy} onClick={() => setOpen(false)}>
            {say("Keep order")}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
