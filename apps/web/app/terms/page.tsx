import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "../../components/legal-document";
export const metadata: Metadata = {
  title: "Terms of Use",
  robots: { index: false, follow: false },
};
export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Use">
      <h2>1. Who we are and what these terms cover</h2>
      <p>
        LeetLogic connects farmers and buyers for agricultural produce in Nigeria. The existing
        website identifies the operator as Leetlogic Global Enterprise, Abakaliki, Ebonyi State,
        Nigeria, CAC BN 3575993. These details must be confirmed before the final terms take effect.
        These terms cover the website, customer app, listings, account verification and any order or
        delivery features that are enabled.
      </p>
      <h2>2. Accounts and verification</h2>
      <p>
        Use accurate information and a phone number you control. Keep verification codes and account
        access private. You must be legally able to enter the transactions you make; if you
        represent a business, you must be authorized to act for it. Farmer verification may require
        a farm profile, identity document and supporting evidence. Submit only documents you are
        entitled to provide.
      </p>
      <p>
        Verification is an administrative review, not a guarantee of every listing, product quality,
        delivery or transaction. Applications are read-only while staff review them, and changes may
        be requested. Do not impersonate another person or submit misleading documents.
      </p>
      <h2>3. Listings and acceptable use</h2>
      <p>
        Sellers are responsible for accurate produce descriptions, photos, prices, quantities,
        units, availability, pickup details and handling requirements. Buyers must review these
        details and provide an accurate delivery address. Do not upload unlawful or infringing
        material, create fraudulent listings, misuse another person’s information, harass users or
        interfere with the service. Listings may be moderated and access restricted for misuse;
        contact support if you believe a decision is incorrect.
      </p>
      <h2>4. Orders payments and fees</h2>
      <p>
        Prices are shown in Nigerian naira unless clearly stated otherwise. Review the produce
        total, platform fees and shipping charge separately before confirming an order. Only use
        payment methods explicitly enabled in the app. During testing, do not send real money based
        on a test order or demonstration balance. Live payment collection and payouts depend on the
        payment provider being configured and activated.
      </p>
      <p>
        LeetLogic’s internal order and ledger records are not a bank account or a promise of insured
        deposits. An internal funded status must not be treated as proof of a completed external
        payment. Logistics completion does not itself authorize financial release where a dispute or
        required review remains unresolved.
      </p>
      <h2>5. Delivery and pickup</h2>
      <p>
        Available delivery services depend on the commodity, parcel, route and courier. Quotes and
        estimated arrival times are subject to provider availability and expiry. Bulk loads,
        cold-chain requirements and unsupported produce or routes require manual review. Do not
        assume an international delivery service or a guaranteed delivery date unless expressly
        confirmed for your order.
      </p>
      <h2>6. Cancellations refunds and disputes</h2>
      <p>
        Report missing, damaged, incorrect or undelivered produce promptly through support,
        providing the order reference and relevant evidence. Cancellation and refund requests are
        assessed against the order facts, provider arrangements and applicable law. A cancellation
        or an internal refund status does not establish that an external payment has been returned;
        the confirmed payment outcome must be communicated separately.
      </p>
      <p>
        Nothing in these draft terms removes a consumer right or remedy that cannot lawfully be
        excluded. Fees, restrictions and any applicable cancellation charges must be disclosed
        before the relevant purchase. See the{" "}
        <a href="https://fccpc.gov.ng/consumers/consumer-rights-responsibilities/rights-responsibilities/">
          FCCPC’s consumer rights guidance
        </a>
        .
      </p>
      <h2>7. Privacy content and service availability</h2>
      <p>
        The <Link href="/privacy">Privacy Policy</Link> explains the information needed to operate
        the service. You retain rights to your uploaded content and authorize the use necessary to
        store, display and review it for the service. Do not upload content you do not have
        permission to use. Features may be unavailable during maintenance, outages or the pilot; no
        uninterrupted service or unconfirmed provider capability is promised.
      </p>
      <h2>8. Questions and changes</h2>
      <p>
        Use the <Link href="/contact">contact page</Link> or the website’s listed support email,{" "}
        <a href="mailto:info@leetlogic.com">info@leetlogic.com</a>, for account, order and policy
        questions. The support address must be verified before production. Material changes will be
        identified with an updated policy date and an appropriate notice. The final production terms
        and any dispute provisions require review under applicable Nigerian law.
      </p>
    </LegalDocument>
  );
}
