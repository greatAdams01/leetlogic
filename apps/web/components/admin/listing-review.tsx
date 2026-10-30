"use client";
import { useState, type ReactNode } from "react";
import { verificationLabel as label } from "./verification-review";
type Row = Record<string, any>;
export { formatMoney as listingPrice } from "../../../../packages/contracts/src/money";
import { formatMoney as listingPrice } from "../../../../packages/contracts/src/money";
import { saleUnitLabel } from "../../../../packages/contracts/src/sale-packaging";
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })
    : "Not recorded";
const category = (row: Row) =>
  row.category?.translations?.find((item: Row) => item.locale === "en")?.name ||
  row.category?.slug?.replaceAll("-", " ") ||
  "Uncategorised";
const place = (row: Row) =>
  [row.locationAddress?.city, row.locationAddress?.state].filter(Boolean).join(", ") ||
  "Location not provided";
const tone = (status: string) =>
  status === "ACTIVE" || status === "APPROVED"
    ? "positive"
    : status === "REJECTED"
      ? "negative"
      : "pending";
const orderedMedia = (row: Row): Row[] =>
  [...(row.media || [])].sort((a, b) => a.displayOrder - b.displayOrder);
function photoUrl(media?: Row) {
  const id = media?.objectKey?.match(/^produce\/([a-f0-9-]{36})$/i)?.[1];
  return id ? `/api/admin/produce-photos/${id}` : undefined;
}
function Photo({
  media,
  title,
  compact = false,
  index = 0,
}: {
  media?: Row;
  title: string;
  compact?: boolean;
  index?: number;
}) {
  const [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0);
  const url = photoUrl(media);
  return (
    <div className={compact ? "listing-thumb" : "listing-photo"}>
      {url && !failed ? (
        <img
          key={revision}
          src={url}
          alt={`${title} · photo ${index + 1}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="listing-photo-empty">
          {compact ? "No preview" : failed ? "Photo could not load" : "No photo available"}
        </div>
      )}
      {!compact && (
        <div className="listing-photo-caption">
          <span>{index === 0 ? "Cover photo" : `Photo ${index + 1}`}</span>
          {url && (
            <div className="live-actions">
              {failed && (
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setFailed(false);
                    setRevision((value) => value + 1);
                  }}
                >
                  Retry
                </button>
              )}
              <a href={url} target="_blank" rel="noreferrer">
                Open photo ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function Fact({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <dt>{title}</dt>
      <dd>{children ?? "Not provided"}</dd>
    </div>
  );
}
export function ListingQueue({
  items,
  busy,
  selectedId,
  onReview,
}: {
  items: Row[];
  busy: boolean;
  selectedId?: string;
  onReview: (row: Row) => void;
}) {
  return (
    <div className="live-table-wrap">
      <table className="listing-queue">
        <thead>
          <tr>
            <th>Produce</th>
            <th>Farmer</th>
            <th>Price & stock</th>
            <th>Status</th>
            <th>Created</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className={selectedId === row.id ? "listing-row-selected" : undefined}>
              <td>
                <div className="listing-produce-cell">
                  <Photo compact media={orderedMedia(row)[0]} title={row.title} />
                  <div>
                    <strong>{row.title}</strong>
                    <small>{category(row)}</small>
                    <small>{place(row)}</small>
                  </div>
                </div>
              </td>
              <td>
                <strong>{row.farmerProfile?.farmName || "Farm not provided"}</strong>
                <small>{row.farmerProfile?.user?.profile?.fullName || "Name not provided"}</small>
                <small>{label(row.farmerProfile?.verificationStatus)}</small>
              </td>
              <td>
                <strong>
                  {listingPrice(row.unitPriceMinor)} /{" "}
                  {saleUnitLabel(row.salePackaging) || row.unit?.name || row.unitCode}
                </strong>
                <small>
                  {row.availableQuantity} in stock · {row.reservedQuantity} reserved
                </small>
              </td>
              <td>
                <span className={`verification-status ${tone(row.status)}`}>
                  {label(row.status)}
                </span>
              </td>
              <td>{date(row.createdAt)}</td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => onReview(row)}
                  aria-label={`Review ${row.title}`}
                  aria-expanded={selectedId === row.id}
                >
                  Review →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ListingReview({
  record,
  canDecide,
  busy,
  onStatus,
  onCompletePacking,
}: {
  record: Row;
  canDecide: boolean;
  busy: boolean;
  onStatus: (status: string) => void;
  onCompletePacking?: () => void;
}) {
  const farm = record.farmerProfile || {},
    user = farm.user || {},
    media = orderedMedia(record);
  const editable = ["PENDING_REVIEW", "ACTIVE", "PAUSED", "REJECTED"].includes(record.status);
  const approved = farm.verificationStatus === "APPROVED";
  return (
    <div className="verification-review listing-review">
      <div className="verification-overview">
        <div>
          <span className="verification-caption">LISTING STATUS</span>
          <span className={`verification-status ${tone(record.status)}`}>
            {label(record.status)}
          </span>
        </div>
        <div>
          <span className="verification-caption">UNIT PRICE</span>
          <strong>
            {listingPrice(record.unitPriceMinor)} /{" "}
            {saleUnitLabel(record.salePackaging) || record.unit?.name || record.unitCode}
          </strong>
        </div>
        <div>
          <span className="verification-caption">STOCK</span>
          <strong>
            {record.availableQuantity} in stock · {record.reservedQuantity} reserved
          </strong>
        </div>
        <div>
          <span className="verification-caption">CREATED</span>
          <strong>{date(record.createdAt)}</strong>
        </div>
      </div>
      <section className="verification-section">
        <div className="verification-section-heading">
          <h3>Produce photos</h3>
          <span>{media.length} uploaded · authenticated access</span>
        </div>
        {media.length ? (
          <div className="listing-photos">
            {media.map((item, index) => (
              <Photo key={item.id} media={item} title={record.title} index={index} />
            ))}
          </div>
        ) : (
          <p className="verification-muted">No produce photos were attached to this listing.</p>
        )}
      </section>
      <div className="verification-grid">
        <section className="verification-section">
          <div className="verification-section-heading">
            <h3>Produce details</h3>
          </div>
          <dl>
            <Fact title="Product">{record.title}</Fact>
            <Fact title="Category">{category(record)}</Fact>
            <Fact title="Selling unit">
              {saleUnitLabel(record.salePackaging) || record.unit?.name || record.unitCode}
            </Fact>
            <Fact title="Source language">
              {{ en: "English", pcm: "Nigerian Pidgin", ha: "Hausa", ig: "Igbo", yo: "Yoruba" }[
                record.sourceLocale as string
              ] || record.sourceLocale}
            </Fact>
          </dl>
          {record.packingAssistanceRequested && (
            <section className="listing-section">
              <h3>Package measurements needed</h3>
              <p>
                The farmer requested packing help. Confirm the measurements with the farmer before
                completing this form. Purchases and publication are blocked until this is completed.
              </p>
              {canDecide && record.status === "PENDING_REVIEW" && (
                <button type="button" disabled={busy} onClick={onCompletePacking}>
                  Complete package measurements
                </button>
              )}
            </section>
          )}
          {record.packaging && (
            <>
              <h4>Packing & handling</h4>
              <dl>
                <Fact title="Selling units per parcel">{record.packaging.unitsPerPackage}</Fact>
                <Fact title="Packed weight">{record.packaging.weightKg} kg</Fact>
                <Fact title="Dimensions">
                  {record.packaging.length} × {record.packaging.width} × {record.packaging.height}{" "}
                  cm
                </Fact>
                <Fact title="Handling">{label(record.packaging.handling)}</Fact>
                <Fact title="Instructions">{record.packaging.notes || "None"}</Fact>
              </dl>
            </>
          )}
          <h4>Description</h4>
          <p className="verification-prose">{record.description || "No description provided."}</p>
        </section>
        <section className="verification-section">
          <div className="verification-section-heading">
            <h3>Farmer & pickup</h3>
            <span className={`verification-status ${tone(farm.verificationStatus)}`}>
              {label(farm.verificationStatus)}
            </span>
          </div>
          <dl>
            <Fact title="Farm">{farm.farmName}</Fact>
            <Fact title="Farmer">{user.profile?.fullName || user.profile?.displayName}</Fact>
            <Fact title="Phone">{user.phoneE164}</Fact>
            <Fact title="Account status">{label(user.status)}</Fact>
            <Fact title="Listing pickup address">
              {record.locationAddress
                ? [
                    record.locationAddress.line1,
                    record.locationAddress.city,
                    record.locationAddress.lga,
                    record.locationAddress.state,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : undefined}
            </Fact>
            <Fact title="Delivery scope">
              {record.shippingScope === "LOCAL"
                ? "Within the farm’s state"
                : record.shippingScope === "NATIONWIDE"
                  ? "Supported areas in Nigeria"
                  : label(record.shippingScope)}
            </Fact>
          </dl>
          <p className="verification-muted">
            Delivery coverage and parcel eligibility are confirmed before payment.
          </p>
        </section>
      </div>
      <section className="verification-decision">
        <div>
          <h3>Moderation decision</h3>
          <p className="verification-muted">
            {!editable
              ? "This listing’s current status does not allow further moderation."
              : !approved
                ? "The farmer must be approved before this listing can be published."
                : "Check the photos, produce information and farmer details before publishing. Every decision requires a reason and is recorded in the audit log."}
          </p>
        </div>
        {canDecide && editable && (
          <div className="live-actions">
            {record.status !== "ACTIVE" && (
              <button
                type="button"
                disabled={busy || !approved || !!record.packingAssistanceRequested}
                onClick={() => onStatus("ACTIVE")}
              >
                {record.status === "PENDING_REVIEW" ? "Approve listing" : "Publish listing"}
              </button>
            )}
            {record.status === "PENDING_REVIEW" && (
              <button
                type="button"
                className="secondary verification-reject"
                disabled={busy}
                onClick={() => onStatus("REJECTED")}
              >
                Reject listing
              </button>
            )}
            {record.status === "ACTIVE" && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => onStatus("PAUSED")}
              >
                Pause listing
              </button>
            )}
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => onStatus("ARCHIVED")}
            >
              Archive listing
            </button>
          </div>
        )}
      </section>
      <details className="verification-reference">
        <summary>Listing reference</summary>
        <dl>
          <Fact title="Listing ID">{record.id}</Fact>
          <Fact title="Updated">{date(record.updatedAt)}</Fact>
        </dl>
      </details>
    </div>
  );
}
