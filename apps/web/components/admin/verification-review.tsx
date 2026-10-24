"use client";
import { useState, type ReactNode } from "react";
type RecordData = Record<string, any>;
export const verificationLabel = (value?: string) =>
  value
    ? value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^./, (c) => c.toUpperCase())
    : "Not provided";
const date = (value?: string) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })
    : "Not recorded";
function Fact({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || <span className="verification-muted">Not provided</span>}</dd>
    </div>
  );
}
function EvidenceFile({ file, index }: { file: RecordData; index: number }) {
  const [preview, setPreview] = useState(false),
    [failed, setFailed] = useState(false);
  const photo = file.mimeType?.startsWith("image/"),
    video = file.mimeType?.startsWith("video/");
  const label = photo ? "Farm photo" : video ? "Farm video" : "Supporting document";
  return (
    <article className="verification-file">
      <div className="verification-file-heading">
        <span className="verification-file-type">
          {photo ? "PHOTO" : video ? "VIDEO" : "DOCUMENT"}
        </span>
        <span className="verification-muted">Private</span>
      </div>
      <h4>
        {label} {index + 1}
      </h4>
      <p className="verification-muted">Uploaded {date(file.createdAt)}</p>
      {preview &&
        !failed &&
        (photo ? (
          <img
            src={file.readUrl}
            alt={`Private farm evidence ${index + 1}`}
            onError={() => setFailed(true)}
          />
        ) : video ? (
          <video
            controls
            preload="metadata"
            src={file.readUrl}
            aria-label={`Private farm video ${index + 1}`}
            onError={() => setFailed(true)}
          />
        ) : null)}
      {failed && (
        <p className="verification-file-error" role="status">
          Preview could not load. Refresh file links, then try again.
        </p>
      )}
      <div className="live-actions">
        {(photo || video) && !failed && (
          <button className="secondary" type="button" onClick={() => setPreview(!preview)}>
            {preview ? "Hide preview" : "Preview"}
          </button>
        )}
        <a href={file.readUrl} target="_blank" rel="noreferrer">
          Open {photo ? "photo" : video ? "video" : "document"} ↗
        </a>
      </div>
    </article>
  );
}
export function VerificationReview({
  record,
  canDecide,
  busy,
  reviewerName,
  onDecision,
  onRefresh,
}: {
  record: RecordData;
  canDecide: boolean;
  busy: boolean;
  reviewerName?: string;
  onDecision: (decision: "approve" | "reject") => void;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const farm = record.farmerProfile || {},
    user = farm.user || {},
    profile = user.profile || {},
    address = farm.primaryAddress;
  const media = (record.evidence || []).filter((e: RecordData) => e.readUrl);
  const notes = (record.evidence || [])
    .filter((e: RecordData) => e.note)
    .sort((a: RecordData, b: RecordData) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const reviews = [...(record.reviews || [])].sort(
    (a: RecordData, b: RecordData) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const identity = record.identity,
    identityNeeded = record.identityRequired || !!identity;
  const pending = ["SUBMITTED", "UNDER_REVIEW"].includes(record.status);
  const state =
    record.status === "APPROVED"
      ? "positive"
      : record.status === "REJECTED"
        ? "negative"
        : "pending";
  const missing: Record<string, string> = {
    government_data: "Government ID check",
    selfie: "Selfie check",
    user_data: "Personal details check",
  };
  return (
    <div className="verification-review">
      <div className="verification-overview">
        <div>
          <span className="verification-caption">APPLICATION STATUS</span>
          <span className={`verification-status ${state}`}>{verificationLabel(record.status)}</span>
        </div>
        <div>
          <span className="verification-caption">SUBMITTED</span>
          <strong>{record.submittedAt ? date(record.submittedAt) : "Not submitted yet"}</strong>
        </div>
        <div>
          <span className="verification-caption">FARM EVIDENCE</span>
          <strong>
            {media.length} {media.length === 1 ? "file" : "files"} attached
          </strong>
        </div>
        <div>
          <span className="verification-caption">LAST UPDATED</span>
          <strong>{date(record.updatedAt)}</strong>
        </div>
      </div>
      <div className="verification-grid">
        <section className="verification-section" aria-labelledby="verification-farmer-heading">
          <div className="verification-section-heading">
            <h3 id="verification-farmer-heading">Farmer & farm details</h3>
            <span>01</span>
          </div>
          <dl>
            <Fact label="Applicant name">{profile.fullName || profile.displayName}</Fact>
            <Fact label="Phone number">{user.phoneE164}</Fact>
            <Fact label="Email address">{profile.email}</Fact>
            <Fact label="Farm / business name">{farm.farmName}</Fact>
            <Fact label="Farmer type">{farm.farmType}</Fact>
            <Fact label="Account created">{date(user.createdAt || farm.createdAt)}</Fact>
          </dl>
          <h4>Farm description</h4>
          <p className="verification-prose">
            {farm.description || "No farm description provided."}
          </p>
        </section>
        <section className="verification-section" aria-labelledby="verification-location-heading">
          <div className="verification-section-heading">
            <h3 id="verification-location-heading">Farm location</h3>
            <span>02</span>
          </div>
          {address ? (
            <>
              <dl>
                <Fact label="State">{address.state}</Fact>
                <Fact label="Local government area">{address.lga}</Fact>
                <Fact label="City / community">{address.city}</Fact>
                <Fact label="Country">
                  {address.countryCode === "NG" ? "Nigeria" : address.countryCode}
                </Fact>
              </dl>
              <h4>Farm address</h4>
              <p className="verification-prose">
                {[address.line1, address.line2].filter(Boolean).join(", ") || "Not provided"}
              </p>
              {address.landmark && (
                <p className="verification-muted">Landmark: {address.landmark}</p>
              )}
            </>
          ) : (
            <p className="verification-muted">No farm address has been provided.</p>
          )}
        </section>
      </div>
      <section className="verification-section" aria-labelledby="verification-identity-heading">
        <div className="verification-section-heading">
          <h3 id="verification-identity-heading">Identity verification</h3>
          <span>03</span>
        </div>
        {identityNeeded ? (
          <>
            <div className="verification-identity-summary">
              <span
                className={`verification-status ${record.identityPassed ? "positive" : "pending"}`}
              >
                {record.identityPassed
                  ? "Identity verified"
                  : identity
                    ? verificationLabel(identity.status)
                    : "Not started"}
              </span>
              <span className="verification-muted">
                Provider: Dojah{identity?.mode ? ` · ${verificationLabel(identity.mode)}` : ""}
              </span>
              {identity?.updatedAt && (
                <span className="verification-muted">Updated {date(identity.updatedAt)}</span>
              )}
            </div>
            <p className="verification-muted">
              Identity verification confirms the applicant’s identity. Farm ownership and evidence
              still require your review.
            </p>
            {identity?.mode === "sandbox" && (
              <p className="verification-file-error">
                Sandbox result: this is not a real identity check.
              </p>
            )}
            {!record.identityPassed && identity?.summary?.missingRequiredSteps?.length > 0 && (
              <p className="verification-file-error">
                Checks requiring attention:{" "}
                {identity.summary.missingRequiredSteps
                  .map((key: string) => missing[key] || verificationLabel(key))
                  .join(", ")}
                .
              </p>
            )}
          </>
        ) : (
          <p className="verification-muted">Review the identity documents attached below.</p>
        )}
        {record.documents?.length > 0 && (
          <div className="verification-document-list">
            {record.documents.map((file: RecordData) => (
              <div key={file.id}>
                <div>
                  <strong>{verificationLabel(file.documentType)}</strong>
                  <span className="verification-muted">
                    {file.referenceLastFour ? `Reference ending ${file.referenceLastFour} · ` : ""}
                    {file.mimeType || "Identity document"}
                  </span>
                </div>
                {file.readUrl && (
                  <a href={file.readUrl} target="_blank" rel="noreferrer">
                    Open document ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        {!identityNeeded && !record.documents?.length && (
          <p className="verification-file-error">No identity documents attached.</p>
        )}
      </section>
      <section className="verification-section" aria-labelledby="verification-evidence-heading">
        <div className="verification-section-heading">
          <div>
            <h3 id="verification-evidence-heading">Farm evidence</h3>
            <p className="verification-muted">Private uploads and the farmer’s supporting notes.</p>
          </div>
          <button
            className="secondary"
            type="button"
            disabled={busy || refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                await onRefresh();
              } finally {
                setRefreshing(false);
              }
            }}
          >
            {refreshing ? "Refreshing…" : "Refresh file links"}
          </button>
        </div>
        {media.length ? (
          <div className="verification-files">
            {media.map((file: RecordData, index: number) => (
              <EvidenceFile key={file.id + file.readUrl} file={file} index={index} />
            ))}
          </div>
        ) : (
          <p className="verification-muted">No farm photos or videos attached.</p>
        )}
        {notes.length > 0 && (
          <div className="verification-notes">
            <h4>Supporting note</h4>
            <p className="verification-prose">{notes[0].note}</p>
            {notes.length > 1 && (
              <details>
                <summary>Earlier notes ({notes.length - 1})</summary>
                {notes.slice(1).map((note: RecordData) => (
                  <article key={note.id}>
                    <small className="verification-muted">{date(note.createdAt)}</small>
                    <p className="verification-prose">{note.note}</p>
                  </article>
                ))}
              </details>
            )}
          </div>
        )}
        <p className="verification-file-footnote">
          File links expire after 5 minutes. Refresh the links if a file no longer opens.
        </p>
      </section>
      <section className="verification-section" aria-labelledby="verification-history-heading">
        <div className="verification-section-heading">
          <h3 id="verification-history-heading">Review history</h3>
          <span>
            {reviews.length} {reviews.length === 1 ? "decision" : "decisions"}
          </span>
        </div>
        {reviews.length ? (
          <ol className="verification-history">
            {reviews.map((review: RecordData) => (
              <li key={review.id}>
                <div>
                  <strong>{verificationLabel(review.decision)}</strong>
                  <time>{date(review.createdAt)}</time>
                </div>
                <p className="verification-prose">{review.reason}</p>
                {review.internalNotes && (
                  <p className="verification-muted">Internal note: {review.internalNotes}</p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="verification-muted">No staff decision has been recorded yet.</p>
        )}
      </section>
      <div className="verification-decision">
        <div>
          <h3>{pending ? "Review decision" : "Application outcome"}</h3>
          <p className="verification-muted">
            {pending
              ? canDecide
                ? `Reviewing as ${reviewerName || "staff"}. A reason is required to record your decision.`
                : "You have view-only access to this application."
              : `This application is ${verificationLabel(record.status).toLowerCase()}.${record.decidedAt ? ` Decision recorded ${date(record.decidedAt)}.` : ""}`}
          </p>
          {pending && record.identityRequired && !record.identityPassed && (
            <p className="verification-file-error">
              Approval is unavailable until the required identity check is verified.
            </p>
          )}
        </div>
        {pending && canDecide && (
          <div className="live-actions">
            <button
              className="secondary verification-reject"
              disabled={busy}
              onClick={() => onDecision("reject")}
            >
              Reject application
            </button>
            <button
              disabled={busy || (record.identityRequired && !record.identityPassed)}
              onClick={() => onDecision("approve")}
            >
              Approve farmer
            </button>
          </div>
        )}
      </div>
      <details className="verification-reference">
        <summary>Application reference</summary>
        <dl>
          <Fact label="Case ID">{record.id}</Fact>
          <Fact label="Created">{date(record.createdAt)}</Fact>
        </dl>
      </details>
    </div>
  );
}
