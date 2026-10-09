import { Cta } from "../../components/site";
import { ContactForm } from "../../components/contact-form";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata("/contact");

export default function ContactPage() {
  return (
    <div className="leetlogic-home-1" data-name="Leetlogic — Contact">
      <div className="page-banner-section-86" data-name="Page banner section">
        <div className="page-banner-87" data-name="Page banner">
          <div className="intersect-square-88" data-name="intersect-square">
            <img alt="" className="text-29" src="/figma/f2246.svg" />
          </div>
          <h1 className="text-89">Get in touch</h1>
          <p className="text-90">
            Questions about listing produce, sourcing wholesale tons, verification, or logistics?
            Our team is ready to help.
          </p>
        </div>
      </div>
      <div className="section-30" data-name="Section">
        <div className="contact-content-181" data-name="Contact content">
          <div className="contact-form-column-182" data-name="Contact form column">
            <div className="section-heading-33" data-name="Section heading">
              <p className="text-34">Send a message</p>
              <h2 className="text-35">Direct contact form</h2>
              <p className="text-36">
                Tell us what you want to sell, source, or solve. We’ll route your inquiry to the
                right team.
              </p>
            </div>
            <ContactForm />
          </div>
          <div className="direct-reach-183" data-name="Direct reach">
            <div className="section-heading-33" data-name="Section heading">
              <p className="text-34">Direct reach</p>
              <h2 className="text-35">Alternate channels</h2>
              <p className="text-36">Connect through our support lines and help desk.</p>
            </div>
            <div className="channels-184" data-name="Channels">
              <div className="contact-channel-185" data-name="Contact channel">
                <div className="icon-badge-186" data-name="Icon badge">
                  <div className="check-circle-147" data-name="message-square">
                    <img alt="" className="text-29" src="/figma/25bd0.svg" />
                  </div>
                </div>
                <div className="channel-details-187" data-name="Channel details">
                  <p className="text-188">WhatsApp agritech line</p>
                  <p className="text-189">+234 800 LEETLOGIC</p>
                </div>
              </div>
              <div className="contact-channel-185" data-name="Contact channel">
                <div className="icon-badge-186" data-name="Icon badge">
                  <div className="check-circle-147" data-name="phone-call">
                    <img alt="" className="text-29" src="/figma/5bc99.svg" />
                  </div>
                </div>
                <div className="channel-details-187" data-name="Channel details">
                  <p className="text-188">Direct voice helpline</p>
                  <p className="text-189">
                    <a href="tel:+2348081112222">+234 808 111 2222</a>
                  </p>
                </div>
              </div>
              <div className="contact-channel-185" data-name="Contact channel">
                <div className="icon-badge-186" data-name="Icon badge">
                  <div className="check-circle-147" data-name="mail">
                    <img alt="" className="text-29" src="/figma/76ec4.svg" />
                  </div>
                </div>
                <div className="channel-details-187" data-name="Channel details">
                  <p className="text-188">Help desk email</p>
                  <p className="text-189">
                    <a href="mailto:info@leetlogic.com">info@leetlogic.com</a>
                  </p>
                </div>
              </div>
            </div>
            <div className="location-190" data-name="Location">
              <p className="text-191">Our Ebonyi location</p>
              <div className="abakaliki-map-192" data-name="Abakaliki map">
                <img
                  alt="Abakaliki Map"
                  className="text-13"
                  src="/optimized/e0fe4.webp"
                  width={1584}
                  height={672}
                  decoding="async"
                  loading="lazy"
                />
              </div>
              <p className="text-193">
                Leetlogic Global Enterprise, Abakaliki, Ebonyi State, Nigeria. Registered under CAC
                BN No. 3575993.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="faq-callout-194" data-name="FAQ callout">
        <h2 className="text-195">Have quick questions?</h2>
        <p className="text-196">
          Find immediate answers about logistics tracking, buyer guarantee escrow, crop
          verification, and CAC registration.
        </p>
        <Cta href="/about#faq">Check marketplace FAQ</Cta>
      </div>
    </div>
  );
}
