"use client";
import Link from "next/link";
import { useState } from "react";
import { farmerOrderGuide } from "../../../packages/contracts/src/farmer-order";
import { orderUpdateCopy } from "../../../packages/contracts/src/order-updates";
import { formatMoney as money } from "../../../packages/contracts/src/money";
import { saleUnitLabel } from "../../../packages/contracts/src/sale-packaging";
import { useLanguage } from "./language-provider";
import { ui } from "../../mobile/src/lib/localization";
import { CustomerPayment } from "./customer-payments";
import { CustomerRecovery } from "./customer-recovery";
export function FarmerOrder({
  data,
  busy,
  notice,
  onAction,
  onRefresh,
}: {
  data: any;
  busy: boolean;
  notice: string;
  onAction: (path: string, body: unknown) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { locale } = useLanguage(),
    say = (s: string) => ui(locale, s),
    guide = farmerOrderGuide(data.progress),
    d = data.delivery;
  const [section, setSection] = useState<"pickup" | "money" | "updates" | null>(null),
    [handoff, setHandoff] = useState(false);
  const panels = {
    pickup: (
      <div className="farmer-extra">
        <p>
          {data.order.suggestedPickup.address}, {data.order.suggestedPickup.state}
        </p>
        {d?.package?.pickupDate && (
          <p>
            {say("Pickup date")}: {d.package.pickupDate}
          </p>
        )}
        {d?.courier && <p>{d.courier}</p>}
        {d?.package && (
          <>
            <p>
              {say("Total packed weight (kg)")}: {d.package.weightKg}
            </p>
            <p>
              {ui(locale, "Package size: {length} × {width} × {height} cm", {
                length: d.package.length,
                width: d.package.width,
                height: d.package.height,
              })}
            </p>
          </>
        )}
        {data.progress?.method === "Pickup" && d?.destination?.phone && (
          <a href={`tel:${d.destination.phone}`}>{say("Call buyer")}</a>
        )}
        {d?.trackingUrl?.startsWith("https://") && (
          <a href={d.trackingUrl} rel="noreferrer" target="_blank">
            {say("Track with courier")}
          </a>
        )}
        {d?.parcels?.map((parcel: any) => (
          <p key={parcel.id}>
            {ui(locale, "Parcel {number}", { number: parcel.parcelIndex + 1 })}:{" "}
            {say(orderUpdateCopy(`status.${parcel.status}`, false).title)}
          </p>
        ))}
      </div>
    ),
    money: (
      <div className="farmer-extra">
        <p>
          {say("Produce value")}: <strong>{money(data.order.totalMinor)}</strong>
        </p>
        <p>{say("Open this section to check payment and earnings.")}</p>
        <CustomerPayment
          orderId={data.order.id}
          isBuyer={false}
          onChanged={onRefresh}
          revision={`${data.order.status}:${d?.status}`}
          disabled={busy}
        />
        <CustomerRecovery orderId={data.order.id} />
      </div>
    ),
    updates: (
      <div className="farmer-extra">
        {d?.events?.length ? (
          <ol>
            {d.events.map((event: any) => (
              <li key={event.id}>
                <strong>{say(orderUpdateCopy(`status.${event.status}`, false).title)}</strong>
                <p>{new Date(event.createdAt).toLocaleString(locale)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>{say("No activity yet.")}</p>
        )}
      </div>
    ),
  };
  return (
    <section className="customer-panel farmer-order">
      <p className="farmer-method">{say(guide.method)}</p>
      <h1>{data.order.title}</h1>
      <p className="farmer-quantity">
        {data.order.quantity || "1"}{" "}
        {saleUnitLabel(data.order.salePackaging, say) || data.order.unitCode}
      </p>
      <p className="farmer-reference">
        {say("Order")}: {data.order.reference.slice(-8).toUpperCase()}
      </p>
      <section className="farmer-next" aria-live="polite">
        <h2>{say(guide.title)}</h2>
        <p>{say(guide.body)}</p>
        {d?.package?.pickupDate && (
          <p>
            {say("Pickup date")}: {d.package.pickupDate.split("-").reverse().join("/")}
          </p>
        )}
        {(d?.package || data.order.packageSuggestion) && (
          <p>
            <strong>
              {say("Number of packages")}:{" "}
              {d?.package?.packageCount || data.order.packageSuggestion?.packageCount || 1}
            </strong>
          </p>
        )}
        {(d?.package?.notes || data.order.packageSuggestion?.notes) && (
          <p>{d?.package?.notes || data.order.packageSuggestion?.notes}</p>
        )}
      </section>
      {notice && <p role="status">{notice}</p>}
      <ol className="farmer-steps" aria-label={say("Order progress")}>
        {["Prepare", "Hand over", "Finished"].map((label, index) => (
          <li key={label} className={guide.step > index ? "reached" : ""}>
            {say(label)}
          </li>
        ))}
      </ol>
      {guide.action && (
        <div className="farmer-primary">
          {handoff && guide.action === "dispatch" ? (
            <section className="farmer-confirm">
              <h2>{say("Has the rider collected everything?")}</h2>
              <p>{say("Only confirm after handing every package to the rider.")}</p>
              <button
                disabled={busy}
                onClick={async () => {
                  await onAction("/dispatch", {});
                  setHandoff(false);
                }}
              >
                {say("Rider has collected it")}
              </button>
              <button className="secondary" disabled={busy} onClick={() => setHandoff(false)}>
                {say("Cancel")}
              </button>
            </section>
          ) : (
            <button
              disabled={busy}
              onClick={() =>
                guide.action === "ready" ? void onAction("/ready", {}) : setHandoff(true)
              }
            >
              {say(guide.action === "ready" ? "Order is ready" : "Rider has collected it")}
            </button>
          )}
        </div>
      )}
      {(
        [
          ["pickup", "Pickup details"],
          ["money", "Money"],
          ["updates", "Order notifications"],
        ] as const
      ).map(([key, label]) => (
        <section key={key} className="farmer-disclosure">
          <button
            type="button"
            aria-expanded={section === key}
            aria-controls={`farmer-${key}`}
            onClick={() => setSection(section === key ? null : key)}
          >
            {say(label)}
            <span aria-hidden="true">{section === key ? "−" : "+"}</span>
          </button>
          {section === key && <div id={`farmer-${key}`}>{panels[key]}</div>}
        </section>
      ))}
      <div className="farmer-help">
        <Link href="/contact">{say("Get help")}</Link>
        <button className="secondary" disabled={busy} onClick={() => void onRefresh()}>
          {say("Refresh")}
        </button>
      </div>
    </section>
  );
}
