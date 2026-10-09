import type { Metadata } from "next";

const configuredUrl = process.env.SITE_URL || process.env.URL || "https://leetlogicglobal.netlify.app";
export const siteUrl = new URL(configuredUrl);
if (!['http:', 'https:'].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) {
  throw new Error("SITE_URL must be a public HTTP(S) URL without credentials.");
}
siteUrl.pathname = "/";
siteUrl.search = "";
siteUrl.hash = "";

export const indexable = Boolean(configuredUrl)
  && !["localhost", "127.0.0.1", "[::1]"].includes(siteUrl.hostname)
  && process.env.NODE_ENV === "production"
  && (!process.env.CONTEXT || process.env.CONTEXT === "production");

export const pages = {
  "/": { title: "Connecting Nigerian Farmers & Buyers", description: "Sell local. Reach global. LeetLogic connects Nigerian farmers directly with buyers through a farmer-first agricultural marketplace." },
  "/about": { title: "About LeetLogic", description: "Learn about LeetLogic's mission to connect Nigerian farmers with buyers, improve market access, and build a more transparent agricultural supply chain." },
  "/team": { title: "Founder & Team", description: "Meet the people behind LeetLogic and discover the vision guiding our farmer-first approach to agricultural trade in Nigeria." },
  "/for-buyers": { title: "Source Agricultural Produce in Nigeria", description: "Explore agricultural sourcing with LeetLogic. Connect with Nigerian farmers and discover produce categories for your business." },
  "/how-it-works": { title: "How LeetLogic Works", description: "Discover how LeetLogic connects farmers and buyers, from joining the network and finding produce to coordinating agricultural trade." },
  "/impact": { title: "Our Agricultural Impact", description: "Explore LeetLogic's approach to farmer livelihoods, market access, and a more sustainable agricultural supply chain in Nigeria." },
  "/contact": { title: "Contact LeetLogic", description: "Get in touch with LeetLogic about buying produce, joining as a farmer, partnerships, or general questions about our agricultural marketplace." },
} as const;

export function pageMetadata(path: keyof typeof pages): Metadata {
  const { title, description } = pages[path];
  const images = [{ url: "/social-preview.jpg", width: 1200, height: 630, alt: "LeetLogic — Sell local. Reach global." }];
  return {
    title, description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "en_NG", siteName: "LeetLogic", title: `${title} | LeetLogic`, description, url: path, images },
    twitter: { card: "summary_large_image", title: `${title} | LeetLogic`, description, images },
  };
}

export const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": new URL("/#organization", siteUrl).href, name: "LeetLogic", url: siteUrl.href, logo: new URL("/brand-logo.png", siteUrl).href },
    { "@type": "WebSite", "@id": new URL("/#website", siteUrl).href, name: "LeetLogic", url: siteUrl.href, inLanguage: "en", publisher: { "@id": new URL("/#organization", siteUrl).href } },
  ],
};
