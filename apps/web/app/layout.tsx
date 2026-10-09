import type { Metadata } from "next";
import { indexable, siteUrl, structuredData } from "../lib/seo";
import { Header, Footer } from "../components/site";
import "./fonts.css";
import "./design.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "LeetLogic",
  robots: { index: indexable, follow: indexable },
  title: { default: "LeetLogic — Sell local. Reach global.", template: "%s | LeetLogic" },
  description:
    "Connecting Nigerian farmers directly to buyers. Discover LeetLogic’s farmer-first agricultural marketplace.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {indexable && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
