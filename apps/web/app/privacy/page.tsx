import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "../../components/legal-document";
export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: false, follow: false },
};
export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy">
      <h2>1. Who is responsible</h2>
      <p>
        This draft describes personal information handled for LeetLogic’s website and customer app.
        The existing contact page identifies Leetlogic Global Enterprise in Abakaliki, Ebonyi State,
        Nigeria, CAC BN 3575993. The responsible legal entity and privacy contact must be verified
        before this policy is finalized.
      </p>
      <h2>2. Information involved</h2>
      <p>
        Account information includes your phone number, optional name and email, chosen language,
        device or session identifiers, and authentication records. A farmer application includes
        farm details, address, identity-document images and supporting evidence. Listings include
        descriptions, photos, stock, prices and the public location information displayed with the
        listing. Orders may include pickup and delivery addresses, recipient contact details,
        tracking events, payment references, dispute evidence and support communications.
      </p>
      <p>
        Operational records may include IP addresses, request identifiers, response status,
        timestamps and security or audit events. Phone and OTP input is used to verify access. Do
        not send your verification code, bank PIN or full card credentials to support. A payment
        provider may collect information directly under its own notice when live payments are
        enabled.
      </p>
      <h2>3. Why information is used</h2>
      <p>
        Information is used to verify accounts, review seller applications, publish listings, manage
        orders, arrange eligible deliveries, respond to support requests and protect the service
        from fraud or misuse. Depending on the activity, the applicable basis may be performing a
        contract or taking requested steps before one, complying with a legal obligation, a
        proportionate legitimate interest, or consent where required. Optional permissions and
        choices should be explained when the relevant feature is used.
      </p>
      <h2>4. Public information and restricted information</h2>
      <p>
        Produce listings and the location details shown with them may be visible to other users.
        Identity documents and farmer-verification evidence are for authorized verification staff
        rather than public listings. Exact address and recipient details are shared as needed for an
        authorized order or delivery. Avoid including private identity or financial details in
        listing photos, descriptions or public messages.
      </p>
      <h2>5. Providers and sharing</h2>
      <p>
        Hosting, storage, messaging, delivery, translation and payment providers may process the
        limited information needed for the features they support, only when those integrations are
        enabled. Intended services include Africa’s Talking for SMS, Bachs for payments, Shipbubble
        for eligible deliveries, Azure Translator for text translation and Cloudinary for product
        images. Creating an account with a provider does not mean data is already being sent to it.
        The final provider list, processing locations and any international-transfer safeguards must
        be confirmed before production.
      </p>
      <p>
        Text submitted for an enabled translation can be processed by the translation provider and
        cached with its source version. Voice transcription and automatic product-photo
        identification are not currently enabled. Information may also be disclosed where legally
        required or necessary to investigate a security incident or resolve a transaction dispute.
      </p>
      <h2>6. Device storage permissions and security</h2>
      <p>
        The app stores language and onboarding preferences on your device; authentication tokens use
        the platform’s secure storage. Camera or photo-library access is requested when you choose
        to attach an image. You can manage these permissions in device settings. Website sign-in
        uses session cookies. Request logging is designed to exclude bodies, authorization headers,
        query strings and database query values. Development console codes and links are for local
        testing and must not be enabled in production.
      </p>
      <p>
        Access controls and private document storage help protect information, but no service can
        guarantee absolute security. Before launch, production storage, backups, provider access and
        incident-response arrangements must be reviewed.
      </p>
      <h2>7. Retention and your choices</h2>
      <p>
        Information should be retained only for the stated service purpose, required security and
        audit needs, resolution of disputes or an applicable legal obligation. Exact retention
        periods for identity documents, accounts, logs, orders and backups have not yet been
        approved and must be documented before production. Deletion requests may require keeping a
        limited record where a legitimate obligation applies; the reason should be explained.
      </p>
      <p>
        Subject to applicable law, you may request access to your information, correction, deletion,
        restriction or objection, portability, and withdrawal of consent for processing that relies
        on consent. Withdrawal does not undo prior lawful processing. To request help, contact{" "}
        <a href="mailto:info@leetlogic.com">info@leetlogic.com</a> or use the{" "}
        <Link href="/contact">contact page</Link>; this privacy contact must be confirmed before
        launch. Verification of a request should be proportionate to its sensitivity.
      </p>
      <h2>8. Complaints and updates</h2>
      <p>
        You may raise a concern with LeetLogic and may also complain to the{" "}
        <a href="https://ndpc.gov.ng/">Nigeria Data Protection Commission</a>. These disclosures are
        drafted with reference to the{" "}
        <a href="https://ndpc.gov.ng/download/nigeria-data-protection-act-2023">
          Nigeria Data Protection Act 2023
        </a>{" "}
        and the{" "}
        <a href="https://erp.ndpc.gov.ng/privacy_policies">
          NDPC’s explanation of data-subject rights
        </a>
        . Material updates will carry a revised date and an appropriate notice.
      </p>
    </LegalDocument>
  );
}
