import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "./navigation";
import { Logo } from "./logo";

export function Cta({
  children,
  href = "/contact?inquiry=selling",
}: {
  children: ReactNode;
  href?: string;
}) {
  return (
    <Link className="cta" href={href}>
      {children}
      <span>
        <img src="/figma/a24c2.svg" alt="" />
      </span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="site-header">
      <div className="header-rail">
        <Logo />
        <Navigation />
        <Cta href="/contact">Contact Us</Cta>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <Logo reversed />
          <p>
            Connecting smallholder farmers across Nigeria directly to premium buyers nationwide and
            worldwide. Sell local, reach global.
          </p>
          <div className="socials">
            {[
              ["Facebook", "939bd"],
              ["Twitter", "7f982"],
              ["Instagram", "38321"],
              ["LinkedIn", "c6337"],
            ].map(([name, asset]) => (
              <span key={name} title={name} className="social-icon">
                <img src={`/figma/${asset}.svg`} alt={name} />
              </span>
            ))}
          </div>
        </div>
        <div className="footer-links">
          <h2>Marketplace</h2>
          {[
            "All produce",
            "Grains & cereals",
            "Tubers & roots",
            "Fruits & vegetables",
            "Livestock",
          ].map((label) => (
            <Link
              key={label}
              href={`/contact?inquiry=buying&category=${encodeURIComponent(label)}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="footer-links">
          <h2>Company</h2>
          {[
            ["About us", "/about"],
            ["How it works", "/how-it-works"],
            ["Impact", "/impact"],
            ["Founder & team", "/team"],
            ["Contact us", "/contact"],
          ].map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </div>
        <div className="footer-links headquarters">
          <h2>Headquarters</h2>
          <p>
            Leetlogic Global Enterprise
            <br />
            Abakaliki, Ebonyi State, Nigeria.
          </p>
          <p>
            <a href="mailto:info@leetlogic.com">info@leetlogic.com</a>
            <br />
            +234 800 LEETLOGIC
          </p>
        </div>
      </div>
      <div className="footer-divider">
        <img src="/figma/05424.svg" alt="" />
      </div>
      <div className="footer-legal">
        <p>© 2026 Leetlogic Global Enterprise. Registered under CAC BN No. 3575993</p>
        <p>Designed & built in Ebonyi State, Nigeria</p>
      </div>
    </footer>
  );
}
